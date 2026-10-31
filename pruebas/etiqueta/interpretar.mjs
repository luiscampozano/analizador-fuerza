// Lectura de etiquetas nutricionales: del texto del OCR a los numeros (v2.21.0). Incluye textos reales que devolvio
// Tesseract con fotos de prueba (la "g" leida como "9", comas perdidas, "ml" leido como "mi").
import { interpretar } from '../../js/etiqueta.js';
const CASOS = [
  ['INFORMACIÓN NUTRICIONAL\nTamaño por porción 30 g (6 galletas)\nEnergía (Calorías) 150 kcal 628 kJ\nGrasa total 6 g 9%\nGrasa saturada 3 g 15%\nColesterol 0 mg 0%\nCarbohidratos totales 21 g 7%\nAzúcares 8 g\nProteína 2 g 4%', { porcion: 30, kcal: 150, g: 6, c: 21, p: 2, por100: false }],
  ['Información nutricional\nPor porción  Por 100 g\nPorción: 200 ml\nEnergía 124 kcal 62 kcal\nGrasas totales 6,4 g 3,2 g\nCarbohidratos 9,4 g 4,7 g\nProteínas 7,0 g 3,5 g', { porcion: 200, kcal: 62, g: 3.2, c: 4.7, p: 3.5, por100: true }],
  ['Valor energético 1680 kJ\nLípidos 12 g\nHidratos de carbono 60 g\nde los cuales azúcares 20 g\nProteínas 8 g', { kcal: 402, g: 12, c: 60, p: 8 }],
  ['Tamaño por porción 30 9 (6 galletas)\nEnergía (Calorías) 150 kcal 628 kj\nGrasa total 69 9%\nGrasa saturada 39 15%\nGrasa trans og\nCarbohidratos totales 21g 7%\nAzúcares 89\nProteína 2g 4%', { porcion: 30, kcal: 150, g: 6, c: 21, p: 2 }],
  ['Porción: 200 mi (1 vaso)\nPor porción Por 100 mi\nEnergía : \' ; 124 kcal 62 kcal\nGrasas totales 649 — 329 ——\nGrasa saturada — ; 4,09 o 209 o\nCarbohidratos o 949 —_ _ 4,79\nAzúcares ————— %4g — 4,79 -\nProteínas " ; 7,0g 359 —\nSodio Hu. — 100 mg _ 50 mg —', { porcion: 200, kcal: 62, g: 3.2, c: 4.7, p: 3.5, por100: true }],
  // etiqueta real (fideos, 30/10/2026): plastico arrugado; "Calorías" leida como "Calonon", "kcal" como "kca)" y la
  // grasa ilegible: se calcula con las calorias y los otros dos macros
  ['Tamaño de porción 1 Tz (70 g)\nPorciones por paquete Aprox.6\nCalonon 77 1089k) 260kca) |\nCalorias de grasa 40 kJ (10 kcah\n| Ga atotalig — — — 0 *\nGrasa saturada 0g\nCarbohidratos totales 53 g 4%\nFibra dietaria 1g\nProteína 9 g 8%', { porcion: 70, kcal: 260, p: 9, c: 53, g: 1.3, por100: false }],
];
let fallos = 0;
for (const [t, esp] of CASOS) {
  const r = interpretar(t), mal = Object.entries(esp).filter(([k, v]) => r[k] !== v);
  if (mal.length) fallos++;
  console.log(mal.length ? `FAIL ${JSON.stringify(r)} esperaba ${JSON.stringify(esp)}` : `OK ${JSON.stringify(r)}`);
}
console.log(fallos ? `${fallos} caso(s) mal` : 'Todas las etiquetas bien');
