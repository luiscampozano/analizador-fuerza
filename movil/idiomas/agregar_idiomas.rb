# FuerzaPro 1.2: declara español e inglés en el proyecto de iPhone que crea «cap add ios» en Codemagic.
# Copia los InfoPlist.strings (textos de permisos en cada idioma), los agrega a los recursos de la app y deja
# es como idioma base. Con los dos idiomas declarados, la vista web recibe el idioma del teléfono (navigator.language)
# y la app se muestra en inglés si el iPhone está en inglés. Uso: ruby movil/idiomas/agregar_idiomas.rb
require 'xcodeproj'
require 'fileutils'
aqui = __dir__
app = File.join(aqui, '..', 'ios', 'App', 'App')
%w[es en].each do |l|
  FileUtils.mkdir_p(File.join(app, "#{l}.lproj"))
  FileUtils.cp(File.join(aqui, "#{l}.lproj", 'InfoPlist.strings'), File.join(app, "#{l}.lproj", 'InfoPlist.strings'))
end
proy = Xcodeproj::Project.open(File.join(aqui, '..', 'ios', 'App', 'App.xcodeproj'))
objetivo = proy.targets.find { |t| t.name == 'App' } or abort('No encontré el objetivo App')
grupo = proy.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' } or abort('No encontré el grupo App')
unless grupo.children.any? { |c| c.name == 'InfoPlist.strings' }
  variantes = grupo.new_variant_group('InfoPlist.strings')
  %w[es en].each do |l|
    r = variantes.new_reference("#{l}.lproj/InfoPlist.strings")
    r.name = l
    r.last_known_file_type = 'text.plist.strings'
  end
  objetivo.resources_build_phase.add_file_reference(variantes)
end
proy.root_object.development_region = 'es'
proy.root_object.known_regions = %w[es en Base]
proy.save
puts 'Idiomas del proyecto: ' + proy.root_object.known_regions.join(', ')
