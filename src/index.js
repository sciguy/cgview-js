import { version } from '../package.json';

import Anchor from './Anchor';
import Annotation from './Annotation';
import LabelPlacementDefault from './LabelPlacementDefault';
import Backbone from './Backbone';
import Bookmark from './Bookmark';
import Box from './Box';
import Canvas from './Canvas';
import Caption from './Caption';
import CenterLine from './CenterLine';
import CGArray from './CGArray';
import CGObject from './CGObject';
import CGRange from './CGRange';
import { CodonTables, CodonTable } from './CodonTable';
import Color from './Color';
import ColorPicker from './ColorPicker';
import Contig from './Contig';
import Debug from './Debug';
import Divider from './Divider';
import Dividers from './Dividers';
import EventMonitor from './EventMonitor';
import Events from './Events';
import Feature from './Feature';
import Font from './Font';
import { Highlighter, HighlighterElement } from './Highlighter';
import IO from './IO';
import Label from './Label';
import Layout from './Layout';
import LayoutCircular from './LayoutCircular';
import LayoutLinear from './LayoutLinear';
import Legend from './Legend';
import LegendItem from './LegendItem';
import Messenger from './Messenger';
import NCList from './NCList';
import Plot from './Plot';
import CaptionTrackList from './PluginCaptionTrackList';
import Plugins from './Plugins';
// import { PluginsStandard } from './PluginsStandard';
import { PluginsStandard } from './Plugins';
import Position from './Position';
import Rect from './Rect';
import Ruler from './Ruler';
import Sequence from './Sequence';
import SequenceTranslation from './SequenceTranslation';
import SequenceExtractor from './SequenceExtractor';
import Settings from './Settings';
import Slot from './Slot';
import Track from './Track';
import utils from './Utils';
import Viewer from './Viewer';

// export default {
export {
  Viewer,
  utils,
  version,

  Anchor,
  Annotation,
  Backbone,
  Bookmark,
  Box,
  Canvas,
  CenterLine,
  Caption,
  CGArray,
  CGObject,
  CGRange,
  CodonTable,
  CodonTables,
  Color,
  ColorPicker,
  Contig,
  Debug,
  Divider,
  Dividers,
  EventMonitor,
  Events,
  Feature,
  Font,
  Highlighter,
  HighlighterElement,
  IO,
  Label,
  Layout,
  LayoutCircular,
  LayoutLinear,
  Legend,
  LegendItem,
  Messenger,
  NCList,
  Plot,
  CaptionTrackList,
  Plugins,
  PluginsStandard,
  Position,
  Rect,
  Ruler,
  Sequence,
  SequenceTranslation,
  SequenceExtractor,
  Settings,
  Slot,
  Track,
}
