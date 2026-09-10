# This script replaces the record type tables and side navbar
# in docs.html with the attribute and action tables from 
# the major classes. See 'klasses' below.

this_script_dir = File.expand_path(File.dirname(__FILE__))
CGVIEW_JS_DIR = this_script_dir.sub(/scripts.*/, '')

src_dir = File.join(CGVIEW_JS_DIR, 'src')
docs_path = File.join(CGVIEW_JS_DIR, 'docs', 'docs.html')

# Tables and Sideav will follow this order
klasses = ['Viewer', 'Feature', 'Plot', 'Track', 'Settings', 'Legend', 'LegendItem',
           'Caption', 'Annotation', 'Bookmark', 'Backbone', 'Sequence', 'Contig',
           'Ruler', 'Divider']

# Read tables from CGV classes
tables_replacement = "\n"
nav_replacement = ""
klasses.each do |klass| 
  puts "Updating #{klass}..."
  klass_path = File.join(src_dir, "#{klass}.js")
  if File.exist?(klass_path)
    # Add html section start
    tables_replacement += "<section id='s.#{klass}'>\n"
    # Add Heading and link to class
    tables_replacement += "\n## [#{klass}](api/#{klass}.html)\n\n"
    file = File.read(klass_path)

    # Actions and Events
    if file =~ /### Action and Events\n \*\n(.*?)\n \*\n/m
      table = $1
      table.gsub!(/^ \* ?/, '')
      # Add api directory to anchor links
      table.gsub!('(#', "(api/#{klass}.html#")
      # Add api directory to other Class links
      table.gsub!(/\]\(([A-Z])/, '](api/\1')
      # Replace docs links
      table.gsub!('../docs.html', '')
      # puts table
      tables_replacement += table + "\n\n"
    else
      puts "- #{klass}: Actions not found!"
    end

    # Attributes
    # if file =~ /### Attributes\n \*\n(.*?)\n \*\n/m
    if file =~ /### Attributes\n \*\n(.*?)\n \*\n/m
      table = $1
      table.gsub!(/^ \* ?/, '')
      # Add api directory to links
      table.gsub!('(#', "(api/#{klass}.html#")
      # Add api directory to other Class links
      table.gsub!(/\]\(([A-Z])/, '](api/\1')
      # Replace meta-data link
      table.gsub!('../tutorials/details-meta-data.html', 'tutorials/details-meta-data.html')
      # puts table
      # Preserve class and member URLs when translating JSDoc links into site tables.
      table.gsub!(/\{@link (\w+)([.#][\w.]+)?\}/) do
        class_name = Regexp.last_match(1)
        member = Regexp.last_match(2)
        fragment = member&.start_with?('.') ? "##{member}" : member
        %(<a href="api/#{class_name}.html#{fragment}"><code>#{class_name}#{member}</code></a>)
      end
      # Add table to output
      tables_replacement += table + "\n\n"
      # NOTE: keep space after comment "*" to include with copied table
      # e.g. keeping the superscipts legends
    else
      puts "- #{klass}: Attributes not found!"
    end

    # Add html section end
    tables_replacement += "</section>\n"
    nav_replacement += "        <li><a class='side-link indent' href='#s.#{klass}'>#{klass}</a></li>\n"
  else
    puts "File does not exist: '#{klass_path}'"
  end
end

# Put tables in doc.html
# puts tables_replacement
docs_file = File.read(docs_path)

tables_found = false
if docs_file =~ /<!-- REPLACE_TABLES START -->.*<!-- REPLACE_TABLES END -->/m
  puts "Replacing Tables in docs"
  docs_file.sub!(/<!-- REPLACE_TABLES START -->.*<!-- REPLACE_TABLES END -->/m, "<!-- REPLACE_TABLES START -->\n#{tables_replacement}\n<!-- REPLACE_TABLES END -->")
  tables_found = true
else
  puts "No REPLACE_TABLES line found"
end

nav_found = false
if docs_file =~ /<!-- REPLACE_NAV START -->.*<!-- REPLACE_NAV END -->/m
  puts "Replacing Nav in docs"
  docs_file.sub!(/<!-- REPLACE_NAV START -->.*<!-- REPLACE_NAV END -->/m, "<!-- REPLACE_NAV START -->\n#{nav_replacement}\n        <!-- REPLACE_NAV END -->")
  nav_found = true
else
  puts "No REPLACE_NAV line found"
end

if tables_found && nav_found
  puts "Updating File: '#{docs_path}'"
  File.write(docs_path, docs_file)
else
  warn 'Record tables were not updated: docs.html must contain both REPLACE_TABLES and REPLACE_NAV markers.'
  exit 1
end





