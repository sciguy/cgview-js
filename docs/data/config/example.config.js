var exampleConfig = {
  "settings": {
    "backgroundColor": "white",
    "showShading": true,
    "arrowHeadLength": 0.3
  },
  "ruler": {
    "font": "sans-serif, plain, 10",
    "color": "black"
  },
  "legend": {
    "position": "top-right",
    "defaultFont": "sans-serif, plain, 14",
    "defaultDecoration": "auto",
    "items": [
      {
        "name": "CDS",
        "swatchColor": "rgba(0,0,153,0.5)"
      },
      {
        "name": "tRNA",
        "swatchColor": "rgba(153,0,153,0.5)"
      },
      {
        "name": "rRNA",
        "swatchColor": "rgba(0,153,53,0.5)"
      }
    ]
  },
  "captions": [
    {
      "name": "DEFINITION",
      "textAlignment": "center",
      "font": "sans-serif,plain,14",
      "fontColor": "darkblue",
      "position": "bottom-center"
    },
    {
      "name": "ID",
      "textAlignment": "right",
      "font": "sans-serif,bold,10",
      "fontColor": "darkgreen",
      "position": "top-left"
    }
  ],
  "tracks": [
    {
      "name": "CG Content",
      "thicknessRatio": 2,
      "position": "inside",
      "dataType": "plot",
      "dataMethod": "sequence",
      "dataKeys": "gc-content"
    },
    {
      "name": "CG Skew",
      "thicknessRatio": 2,
      "position": "inside",
      "dataType": "plot",
      "dataMethod": "sequence",
      "dataKeys": "gc-skew"
    }
  ]
};
