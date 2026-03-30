//////////////////////////////////////////////////////////////////////////////
// Plugin: CaptionTrackList
//////////////////////////////////////////////////////////////////////////////

/**
 * CGView.js – Interactive Circular Genome Viewer
 * Copyright © 2016–2026 Jason R. Grant
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * CaptionTrackList is a plugin that adds a caption to the map that lists
 * the tracks in the order they are displayed. The caption is updated whenever
 * tracks are added, removed, updated, or moved.
 *
 * To activate this plugin with the defaults, add the following to the caption's options:
 * { pluginOptions: { pluginCaptionTrackList: {} }
 *
 * To customize the plugin, add the following options to the caption's options (shown with defaults): 
 * {
 *   pluginOptions: {
 *     pluginCaptionTrackList: {
 *       collapseTracks: false,
 *       separator: 'return',
 *       startFrom: 'outside',
 *     },
 *   },
 * }
 *
 * OPTIONS:
 * - collapseTracks:
 *   - If true, the plugin will collapse adjacent rings/lanes from the same tracks into a single entry.
 *   - [Default: false].
 * - separator:
 *   - The separator to use between entries. Options are 'return', 'semicolon', and 'comma'.
 *   - [Default: return].
 * - startFrom:
 *   - The direction to start listing tracks. Options are 'inside', 'outside', 'backbone'.
 *   - [Default: outside].
 */
const CaptionTrackList = (() => {
  const pluginName = 'CaptionTrackList';
  const pluginID = 'pluginCaptionTrackList';

  // HELPER METHODS

  // Return the separator based on the key
  const separatorKeyMap = { return: '\n', semicolon: '; ', comma: ', ', };
  const getSeparator = (separatorKey = 'return') =>
    separatorKeyMap[separatorKey] || separatorKeyMap.return;

  // Display label (which lanes/rings) for the track
  // e.g. 'Lane 1: ', 'Lanes 1,2: ', 'Lanes 1-3: ', 'Ring 1: ', 'Rings 1,2: ', 'Rings 1-3: '
  const displayLabel = (index, slots = [], backbone = false, isLinear = false, negative = false) => {
    const linearLabel = 'Lane';
    const circularLabel = 'Ring';
    if (backbone) return '';
    slots = Array.isArray(slots) ? slots : [slots];

    let label = isLinear ? linearLabel : circularLabel;
    label += slots.length > 1 ? 's' : '';

    if (negative) {
      if (slots.length <= 1) return `${label} -${index + 1}: `;
      if (slots.length === 2) return `${label} -${index},-${index + 1}: `;
      return `${label} -${index + 2 - slots.length} to -${index + 1}: `;
    } else {
      if (slots.length <= 1) return `${label} ${index + 1}: `;
      if (slots.length === 2) return `${label} ${index},${index + 1}: `;
      return `${label} ${index + 2 - slots.length} to ${index + 1}: `;
    }
  };

  // Slots is an array of strings that decribes specific slots
  // Returns an empty string or a string containing each slot
  const displaySlots = (slots) => {
    if (!slots || (Array.isArray(slots) && slots[0] === undefined)) return '';
    slots = Array.isArray(slots) ? slots : [slots];
    return slots.length ? ` (${slots.join(',')})` : '';
  };

  // MAIN METHOD to generate the listing text that will be displayed in the caption
  const getListingText = (tracks, isLinear = false, options = {}) => {
    // FIXME: This is a hack to get the startFrom option to work
    const startOutside = options.startFrom === 'outside';
    const separator = getSeparator(options.separator);
    const label = isLinear ? 'lane' : 'ring';
    let direction = isLinear
      ? startOutside ? 'top' : 'bottom'
      : startOutside ? 'outermost' : 'innermost';
    if (options.startFrom === 'backbone') direction = 'backbone';

    // First line of the caption
    let text = `Starting from the ${direction} ${label}:${separator === '\n' ? '\n' : ' '}`;

    const listing = [{ track: { name: 'Backbone (Contigs)', backbone: true } }];

    for (const track of tracks) {
      const { position, separateFeaturesBy } = track;

      // Helper method to add slots to the listing (either inside/push or outside/unshift)
      const addSlots = (slots, unshift = false) =>
        slots.forEach(s => unshift ? listing.unshift({ track, slot: s }) : listing.push({ track, slot: s }));

      if (track.type === 'feature') {
        switch (separateFeaturesBy) {
          case 'strand':
            if (position === 'inside') addSlots(['+', '-']);
            else if (position === 'outside') addSlots(['-', '+'], true);
            else { listing.unshift({ track, slot: '+' }); listing.push({ track, slot: '-' }); }
            break;

          case 'readingFrame':
            if (position === 'inside') addSlots(['+3', '+2', '+1', '-1', '-2', '-3']);
            else if (position === 'outside') addSlots(['-3', '-2', '-1', '+1', '+2', '+3'], true);
            else {
              addSlots(['+1', '+2', '+3'], true);
              addSlots(['-1', '-2', '-3']);
            }
            break;

          case 'type':
          case 'legend':
            const features = track.featuresBy(separateFeaturesBy);
            const sortedKeys = Object.keys(features).sort((a, b) => features[b].length - features[a].length);
            addSlots(sortedKeys, position !== 'inside');
            break;

          default:
            position === 'inside' ? listing.push({ track }) : listing.unshift({ track });
            break;
        }
      } else {
        // Plot tracks
        position === 'inside' ? listing.push({ track }) : listing.unshift({ track });
      }
    }

    if (options.startFrom === 'inside') listing.reverse();

    let entries = [];
    let slots = [];

    console.log(listing)
    if (options.startFrom === 'backbone') {
      const backboneIndex = listing.findIndex(item => item.track.backbone);
      const aboveBackone = listing.slice(0, backboneIndex).reverse();
      const belowBackbone = listing.slice(backboneIndex + 1);
      const aboveBackboneEntries = _getListingSubsetText(aboveBackone, isLinear, options).reverse()
      const belowBackboneEntries = _getListingSubsetText(belowBackbone, isLinear, options, true);
      text += aboveBackboneEntries.join(separator) +
              (aboveBackboneEntries.length ? separator : '') +
              listing[backboneIndex].track.name +
              (belowBackboneEntries.length ? separator : '') +
              belowBackboneEntries.join(separator);
    } else {
      entries = _getListingSubsetText(listing, isLinear, options);
      text += entries.join(separator);
    }

    return text;
  };

  const _getListingSubsetText = (listing, isLinear = false, options = {}, negative = false) => {
    const entries = [];
    let slots = [];
    if (options.collapseTracks) {
      for (let i = 0; i < listing.length; i++) {
        const current = listing[i];
        const next = listing[i + 1];
        slots.push(current.slot);

        if (next && next.track === current.track) continue;

        entries.push(
          `${displayLabel(i, slots, current.track.backbone, isLinear, negative)}${current.track.name}${displaySlots(slots)}`
        );
        slots = [];
      }
    } else {
      listing.forEach((t, i) =>
        entries.push(`${displayLabel(i, t.slot, t.track.backbone, isLinear, negative)}${t.track.name}${displaySlots(t.slot)}`)
      );
    }
    return entries;
  }

  // Events to listen for
  const events = [
    'captions-add',
    'captions-update',
    'tracks-add',
    'tracks-remove',
    'tracks-update',
    'tracks-moved',
    'settings-update',
  ];

  // Plugin definition
  return {
    name: pluginName,
    id: pluginID,
    version: '0.1.0',
    type: 'General',

    install(cgv) {
      console.log(`Installing ${pluginName}`);

      const setDynamicText = () => {
        const tracks = cgv.tracks().filter( (t) => t.visible );
        cgv.captions().forEach((caption) => {
          if (caption.hasPlugin(pluginID)) {
            const options = caption.optionsForPlugin(pluginID);
            console.log("Setting dynamic text for caption", caption, options);
            caption.name = getListingText(tracks, cgv.format === 'linear', options);
          }
        });
      };

      events.forEach(event => {
        cgv.on(`${event}.${pluginID}`, ({attributes}) => {
          // Settings: format
          if (event === 'settings-update' && attributes && !attributes.format) {
            return;
          }
          // Tracks: don't update on loadProgress
          if (event === 'tracks-update' && attributes && attributes.loadProgress) {
            return;
          }
          setDynamicText();
        });
      });
    },

    uninstall(cgv) {
      console.log(`Uninstalling ${pluginName}`);
      events.forEach(event => cgv.off(`${event}.${pluginID}`));
    },

    // Expose the getListingText method
    getListingText(tracks, isLinear = false, options = {}) {
      return getListingText(tracks, isLinear, options);
    },

  };
})();

export default CaptionTrackList;