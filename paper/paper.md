---
title: 'CGView.js: a JavaScript package for visualizing small genomes'
tags:
  - JavaScript
  - genome browser
  - microbial genomes
  - bioinformatics visualization
authors:
  - name: Jason R. Grant
    orcid: 0000-0002-0407-9807
    corresponding: true
    affiliation: 1
  - name: Paul Stothard
    orcid: 0000-0003-4263-969X
    affiliation: 1
affiliations:
 - name: University of Alberta, Canada
   index: 1
   ror: 0160cpw27
date: 4 September 2025
bibliography: paper.bib
---

# Summary

Genome maps are routinely generated as a way of understanding or conveying the functional properties and sequence characteristics of organisms. `CGView.js` is a JavaScript-based viewer designed for microbial and organellar genomes, as well as plasmids. Inspired by the original Java-based `CGView` [@cgview_2005], it generates high-quality interactive maps that can easily be embedded in web pages. Its comprehensive API supports map manipulation and integration with third-party tools, making it suitable for developers building bioinformatics platforms.

# Statement of need

Microbial and organellar genomics frequently require circular maps and fast navigation between scales. `CGView.js` addresses this need by providing circular and linear map layouts with nucleotide-level detail, accessible through an embeddable component suited to web applications. \autoref{fig:examples} shows examples of `CGView.js` circular and linear layouts, plus a zoomed view that displays base-pair detail.

# State of the field

Several JavaScript-based genome browsers, including JBrowse [@jbrowse_2023], igv.js [@igvjs_2022], and pileup.js [@pileup_2016], are widely used for general genomics visualization. However, few support the circular maps that are often preferred for microbial and organellar genomes, and none provide the rapid and smooth zooming to the DNA sequence level available in `CGView.js`. `CGView.js` complements these tools by focusing on circular visualization and tight integration into web pipelines rather than operating as a standalone browser.

# Software design

`CGView.js` is an embeddable interactive map component, intended to be tightly integrated into and managed by surrounding web applications. The API exposes common actions on map components such as features, tracks, contigs, legends, and labels. A standard set of actions is provided (read, add, remove, update, reorder). All actions (except "read") trigger events that can be used as hooks for callbacks. For example, the `features-add` event passes the added features to a callback, enabling host tools to react dynamically.

![`CGView.js` maps of the *Escherichia coli* PA2 genome (GenBank accession: GCF_000335355.2) displaying sequence features and base composition plots. (A) Circular view of the genome. (B) Circular view zoomed to the base pair level, with the legend color picker shown in the top-right corner. (C) Linear view of the same genome.\label{fig:examples}](figure.png)

Maps are rendered using the HTML canvas rather than SVG, which significantly improves performance when displaying thousands of features. During animations such as zooming or panning, the number of visible features is temporarily reduced to maintain responsiveness. Once the animation completes, the map is redrawn at full detail.

`CGView.js` uses web workers to create GC skew, GC content, and ORF tracks based on the provided genome sequence. Web workers generate these tracks in background threads without blocking the user interface, allowing users to continue moving, zooming, or interacting with the map. These processes communicate with the main thread to provide visual feedback in the form of a growing progress track. When the worker is finished, the progress track is replaced with the new plot or set of features.

The performance of `CGView.js` depends on the capabilities of the host system. No internal limits are set on genome size or the number of features that can be displayed. However, large genomes (e.g. more than 10 million base pairs) and large numbers of features (e.g. millions) can result in slower map rendering and navigation. For this reason, we recommend using `CGView.js` primarily for microbial and organellar genomes.

`CGView.js` maps can be quickly generated for sequences in GenBank, EMBL, and FASTA formats using the companion `CGParse.js` package (<https://github.com/sciguy/cgview-parse>). Features described in GenBank and EMBL files are automatically converted into `CGView.js` features for display on the map. `CGParse.js` can also convert GFF3, GTF, BED, CSV, and TSV files into `CGView.js` map features, allowing results from a variety of other sources (e.g. third-party analysis tools) to be easily visualized.

Configuration and interchange rely on a lightweight CGView JSON format that stores genome information and display settings. Maps can be imported from and exported to this format for sharing and archiving. Publication-ready output is supported through PNG export up to 16,000 × 16,000 pixels and SVG export for downstream vector editing.

# Research impact statement

Since its release in 2021, `CGView.js` has been integrated into multiple online bioinformatics platforms and web servers, including `Proksee` [@proksee_2023], `PHASTEST` [@phastest_2023], `PlasMapper 3.0` [@plasmapper_2023], `MOBHunter` [@mobhunter_2025], `PLSDB` [@plsdb_2024], `BASys2` [@basys_2025], and `HLRMDB` [@hlrmdb_2025]. In Proksee, hundreds of `CGView.js` maps are downloaded daily, indicating active external use.

The project website (<https://js.cgview.ca>) provides detailed documentation, examples, and tutorials that generate interactive maps directly from the shown code, supporting reproducibility and community uptake. Users who prefer a graphical interface can use `Proksee` [@proksee_2023], which renders maps with `CGView.js` and exposes many viewer settings through a GUI.

# Conclusion

`CGView.js` enables the generation of high-quality interactive and static genome maps for microbial and organellar genomes. Its embeddable JavaScript design and comprehensive API make it suitable for integration into web-based platforms that visualize genomic annotations or pipeline outputs.

# AI usage disclosure

Generative AI (ChatGPT) was used occasionally for issue triage, small code suggestions, and copy editing of documentation and this manuscript. All AI-assisted code and text were reviewed and verified by the authors. No figures or data were generated by AI.

# Acknowledgements

This work was funded by Genome Alberta and Genome Canada.

# Author contributions

Jason Grant: Conceptualization (equal); Methodology; Software; Visualization; Writing (original draft)
Paul Stothard: Conceptualization (equal); Supervision; Writing (review and editing); Funding acquisition; Resources

# References
