import Foundation
import Capacitor
import HealthKit

// FuerzaPro (v1.1 iPhone): Apple Salud.
// - autorizar(): pide permiso para escribir entrenamientos y energía activa, y leer peso y estatura.
// - guardarEntreno({ inicio, fin, kcal, nombre }): guarda un entrenamiento de fuerza (cierra los anillos de Apple Fitness).
// - leerCuerpo(): devuelve el último peso (kg) y estatura (m) que tenga Apple Salud.
@objc(FuerzaSaludPlugin)
public class FuerzaSaludPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FuerzaSaludPlugin"
    public let jsName = "FuerzaSalud"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "disponible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "autorizar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "guardarEntreno", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "leerCuerpo", returnType: CAPPluginReturnPromise)
    ]

    private let tienda = HKHealthStore()

    private var tiposEscritura: Set<HKSampleType> {
        var s: Set<HKSampleType> = [HKObjectType.workoutType()]
        if let e = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { s.insert(e) }
        return s
    }

    private var tiposLectura: Set<HKObjectType> {
        var s: Set<HKObjectType> = []
        if let p = HKObjectType.quantityType(forIdentifier: .bodyMass) { s.insert(p) }
        if let a = HKObjectType.quantityType(forIdentifier: .height) { s.insert(a) }
        return s
    }

    @objc func disponible(_ call: CAPPluginCall) {
        call.resolve(["disponible": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func autorizar(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Salud no está disponible en este dispositivo.")
            return
        }
        tienda.requestAuthorization(toShare: tiposEscritura, read: tiposLectura) { ok, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                // Apple no dice si la persona aceptó LEER (privacidad); para escribir sí sabemos el estado
                let estado = self.tienda.authorizationStatus(for: HKObjectType.workoutType())
                call.resolve(["ok": ok, "escribir": estado == .sharingAuthorized])
            }
        }
    }

    private func fecha(_ ms: Double?) -> Date? {
        guard let ms = ms else { return nil }
        return Date(timeIntervalSince1970: ms / 1000.0)
    }

    @objc func guardarEntreno(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Salud no está disponible en este dispositivo.")
            return
        }
        guard let inicio = fecha(call.getDouble("inicio")), let fin = fecha(call.getDouble("fin")), fin > inicio else {
            call.reject("Faltan las horas de inicio y fin.")
            return
        }
        guard tienda.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else {
            call.reject("sin_permiso")
            return
        }
        let kcal = max(0, call.getDouble("kcal") ?? 0)
        let nombre = call.getString("nombre") ?? "Entrenamiento"
        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor
        let constructor = HKWorkoutBuilder(healthStore: tienda, configuration: config, device: .local())
        constructor.beginCollection(withStart: inicio) { ok, error in
            guard ok else {
                DispatchQueue.main.async { call.reject(error?.localizedDescription ?? "No se pudo empezar a guardar.") }
                return
            }
            var muestras: [HKSample] = []
            if kcal > 0, let tipo = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
                muestras.append(HKQuantitySample(type: tipo, quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kcal), start: inicio, end: fin))
            }
            let terminar: () -> Void = {
                constructor.endCollection(withEnd: fin) { _, _ in
                    constructor.addMetadata([HKMetadataKeyWorkoutBrandName: "FuerzaPro", "FuerzaPro": nombre]) { _, _ in
                        constructor.finishWorkout { entreno, error in
                            DispatchQueue.main.async {
                                if let entreno = entreno {
                                    call.resolve(["ok": true, "id": entreno.uuid.uuidString])
                                } else {
                                    call.reject(error?.localizedDescription ?? "No se pudo guardar el entrenamiento.")
                                }
                            }
                        }
                    }
                }
            }
            if muestras.isEmpty {
                terminar()
            } else {
                constructor.add(muestras) { _, _ in terminar() }
            }
        }
    }

    private func ultimo(_ id: HKQuantityTypeIdentifier, unidad: HKUnit, listo: @escaping (Double?, Date?) -> Void) {
        guard let tipo = HKObjectType.quantityType(forIdentifier: id) else { listo(nil, nil); return }
        let orden = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let consulta = HKSampleQuery(sampleType: tipo, predicate: nil, limit: 1, sortDescriptors: [orden]) { _, muestras, _ in
            guard let m = muestras?.first as? HKQuantitySample else { listo(nil, nil); return }
            listo(m.quantity.doubleValue(for: unidad), m.endDate)
        }
        tienda.execute(consulta)
    }

    @objc func leerCuerpo(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve([:])
            return
        }
        ultimo(.bodyMass, unidad: .gramUnit(with: .kilo)) { kg, fKg in
            self.ultimo(.height, unidad: .meter()) { m, fM in
                var r: [String: Any] = [:]
                if let kg = kg { r["kg"] = kg }
                if let m = m { r["m"] = m }
                if let f = fKg { r["fechaKg"] = f.timeIntervalSince1970 * 1000.0 }
                if let f = fM { r["fechaM"] = f.timeIntervalSince1970 * 1000.0 }
                DispatchQueue.main.async { call.resolve(r) }
            }
        }
    }
}
