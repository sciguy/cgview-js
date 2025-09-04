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

Several JavaScript-based genome browsers offer impressive capabilities, including `JBrowse` [@jbrowse_2023], `igv.js` [@igvjs_2022], and `pileup.js` [@pileup_2016]. However, few support the circular maps that are often preferred for microbial and organellar genomes, and none provide the rapid and smooth zooming to the DNA sequence level available in `CGView.js`, which allows for quick and thorough exploration of genomic features. \autoref{fig:examples} shows examples of `CGView.js`'s circular and linear map layouts, as well as its ability to display nucleotide-level detail.

`CGView.js` is designed as an embeddable interactive map component, intended to be tightly integrated into and managed by surrounding web applications. Since its release in 2021, `CGView.js` has been integrated into multiple online bioinformatics platforms and web servers, including `Proksee` [@proksee_2023], `PHASTEST` [@phastest_2023], `PlasMapper 3.0` [@plasmapper_2023], `MOBHunter` [@mobhunter_2025], `PLSDB` [@plsdb_2024], and `BASys2` [@basys_2025].

To facilitate this integration, `CGView.js` includes a well-documented API for manipulating and accessing various map components, such as features, tracks, contigs, legends, and labels. The API defines a standard set of actions (read, add, remove, update, and reorder) for manipulating map components. All actions (except "read") trigger events, providing hooks for callback functions. For example, a `features-add` event can pass the added features to a callback, allowing third-party tools to respond dynamically.

Maps are rendered using the HTML canvas rather than SVG elements, which significantly improves performance when displaying thousands of features. During animations such as zooming or panning, `CGView.js` temporarily reduces the number of visible features to maintain responsiveness. Once the animation completes, the map is fully redrawn at high detail.

![`CGView.js` maps of the the *Escherichia coli* PA2 genome (GenBank accession: GCF_000335355.2) displaying various sequence features and base composition plots. (A) Circular view of the genome. (B) Circular view zoomed-in to the base pair level, with the legend color picker shown in the top-right corner. (C) Linear view of the same genome.\label{fig:examples}](figure.png)

`CGView.js` uses web workers to create GC Skew, GC Content, and ORF tracks based on the provided genome sequence. Web workers generate these tracks in background threads without blocking the user interface, allowing users to continue moving, zooming, or interacting with the map. These processes communicate with the main thread to provide visual feedback in the form of a growing progress track. When the worker is finished the progress track is replaced with the new plot or set of features.

The performance of `CGView.js` depends on the capabilities of the host system. No internal limits are set on genome size or the number of features that can be displayed. However, large genomes (e.g more than 10 million base pairs) and large numbers of features (e.g. millions) can result in slower map rendering and navigation. For this reason we recommend that `CGView.js` be used for microbial and organellar genomes.

Example maps illustrating the performance and functionality of `CGView.js` are provided on the `CGView.js` website (<https://js.cgview.ca>), which also offers tutorials and detailed documentation. Each tutorial dynamically generates a working map using the exact code shown in the example, ensuring all examples are functional and reproducible.

`CGView.js` maps can be quickly generated for sequences in GenBank, EMBL, and FASTA formats using the companion `CGParse.js` package (<https://github.com/sciguy/cgview-parse>). Features described in GenBank and EMBL files are automatically converted into `CGView.js` features for display on the map. `CGParse.js` can also convert GFF3, GTF, BED, CSV, and TSV files into `CGView.js` map features, allowing results from a variety of other sources (e.g. third-party analysis tools) to be easily visualized.

Internally `CGView.js` uses the CGView JSON format, which is a lightweight JSON-based format for storing genome information and display settings. This format is designed to be human-readable and easily editable, making it suitable for sharing and archiving maps. `CGView.js` can import and export maps in this format, allowing users to save their work and share it with others.

In addition to serving as an interactive map viewer, `CGView.js` can be used to generate high-resolution static images of genome maps suitable for publication. Maps can be exported as PNG images up to 16,000 × 16,000 pixels in size, or as SVG files. The latter format allows for downstream editing using vector graphics applications.

Users wishing to view maps without having to manually download software can access the capabilities of `CGView.js` through the `Proksee` web server [@proksee_2023]. `Proksee` supports the upload of GenBank, EMBL, FASTA, raw, FASTQ, and CGView JSON files. It automatically creates a `CGView.js` map from the uploaded data and provides access to a variety of integrated tools for further analyzing sequences and displaying them on the map.

In summary, `CGView.js` enables the generation of high-quality interactive and static genome maps for microbial and organellar genomes. Its embeddable JavaScript design and comprehensive API make it suitable for integration into web-based platforms that visualize genomic annotations or pipeline outputs.


# Acknowledgements

This work was funded by Genome Alberta and Genome Canada.


# References
