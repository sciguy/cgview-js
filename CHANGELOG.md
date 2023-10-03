--------------------------------------------------------------------------------
# CGView.js Changelog
--------------------------------------------------------------------------------

## Unreleased
- N/A

## v1.5.0 - 2023-10-03
### Added
- Add labelPlacement to Annotation.toJSON()
- zoomIn/Out options (duration, ease, callback, bbOffset)
- New Color Picker with Hex/RGB values, swatches, and favorites
- Add drawOrder (position [default] or score) to Track
- Add length to default feature popups
## Changed
- Improvements to Angled Labels
- LegendItem highighting uses rounded corners with padding
- Captions highighting uses rounded corners
- Contigs without names will be named 'Unknown'
- toJSON for legendItems now exports meta object
- Moved minArcLength from Settings to Legend and LegendItems
## Removed
- Removed center alignement for legends
## Fixed
- Highlighting legend items in right-aligned legends now works
- When annotation is not visible labels are no longer highlighted when their features are moused over 
- Adding sequence extracted features (e.g. ORFs) no longer triggers dataHasChanged
- Added "type": "module" to package.json to allow the "import" syntax
- Stop muliple features/plots (from sequence) from being added on every track refresh

## v1.4.2 - 2023-03-10
## Fixed
- Feature popups no longer blocked by invisible features
- Improvements to Angled Labels

## v1.4.1 - 2023-03-01
### Added
- Label placement options (change with Annotation.labelPlacement)
  - Default labels (same as before): labels placed in straight line from map
  - Angled labels (in beta testing): labels spread (fan) out around map
- Captions can be centered "on map" (e.g center of circle) using the following settings:
  - lengthPercent: 50
  - mapOffset: 0

## Changed
- Better highlighting of labels (and their lines)

## v1.3.1 - 2023-02-17
### Added
- Viewer.isAnimating property
- Added animation button to tutorial on controls
- Added additional default window & step size for genomes larger than 10 million bp
- Added map and contig position to feature popovers
- Mousing over features will highlight feature label

## Changed
- Default minArcLength changed from 0 to 1
- Viewer.moveTo() and Viewer.zoomTo() now move along the backbone for circular maps when the zoomFactor is above 10

## Fixed
- Hide annotation labels if feature or track is hidden
- Changing layout will reset map position so canvas isn't empty. Fixes [issue#4](https://github.com/stothard-group/cgview-js/issues/4)

## v1.3.0 - 2022-06-24
### Added
- SVG downloads (IO.downloadSVG). Requires [svgcanvas](https://github.com/zenozeng/svgcanvas)
- Ability to animate map between random number of features or an array of features/bookmarks (Viewer.animate)

### Fixed
- Features are now drawn from start-0.5bp to stop+0.5bp. Fixes [issue#3](https://github.com/stothard-group/cgview-js/issues/3)
- Labels now center properly on small features
- Circle bp scale fixed. Top of circle is equal to 1bp and sequence length + 1
- Fixed disappearing features that wrap origin
- Fixed features that wrap origin from drawing past map boundaries on linear maps

## v1.2.0 - 2022-01-21
- Add tags for features and track dataMethod
- Added IO JSON converter for older versions
- Fixed ColorPicker and Highlighter Popup placement
- GeneticCode and format now saved with settings
- Fixed issue with extracting ORFs from contigs
- Ready for release with https://proksee.ca

## v1.1.0 - 2021-09-29
- Remove 'id' attribute from Contig (Use 'name' instead)
- Duplicate Contig and LegendItem names will automically become unique by appending a number
- Added contig.isMapContig property
- Changed contig.hasSeq() to contig.hasSeq (i.e. property instead of function)
- Refresh feature labels when feature start/stop changes
- Default Annotation font changed from 'sans-serif' to 'monospace'
- Changed events:
  - bookmark-shortcut -> bookmarks-shortcut
  - changed 'drag' event to 'zoom'

## v1.0.0 - 2021-08-24
- Initial Release
