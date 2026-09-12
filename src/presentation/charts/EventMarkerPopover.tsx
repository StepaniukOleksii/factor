import React, {useState} from 'react';
import {
  Dimensions,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import type {Event} from '../../domain/Event';
import {formatRelativeTime} from '@shared/formatRelativeTime';
import {COLORS, ELEVATION, RADIUS} from '@presentation/theme';

/**
 * Widest the card may grow, leaving a margin either side of a 412dp screen -
 * wide enough for the longest name an Event may carry to sit on one line.
 */
const MAX_WIDTH = 380;

/** Where the entries start to scroll instead of the card growing past the screen. */
const MAX_ENTRIES_HEIGHT = 366;

/** Kept between the card and the screen's edges when it has to be pushed off centre. */
const SCREEN_MARGIN = 8;
/** Between the handle's target and the card below it. */
const ANCHOR_GAP = 4;

export interface EventMarkerPopoverProps {
  /** The Events the tapped handle stands for, in the order they occurred. */
  events: readonly Event[];
  /** Middle of the handle that opened this, in window coordinates. */
  anchorX: number;
  /** Its target's bottom edge, which the card sits below. */
  anchorY: number;
  onDismiss: () => void;
}

/**
 * What a marker's handle opens: one entry per Event behind it, each the Event's
 * name over the moment it occurred, with its description behind an expander
 * where it has one. The moment stays on the face because two Events may carry
 * the same name, and it is then the only thing telling two entries apart.
 *
 * A `Modal` because an absolutely positioned child of one card paints beneath a
 * later sibling card on Android, and because a `Modal` takes the Android back
 * press in its own window, leaving the screen's zoom history alone.
 */
export const EventMarkerPopover = ({events, anchorX, anchorY, onDismiss}: EventMarkerPopoverProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Unknown until the card has laid out, its width being whatever its widest
  // entry needs, so the first frame draws at the anchor rather than centred.
  const [cardWidth, setCardWidth] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const left = Math.max(
    SCREEN_MARGIN,
    Math.min(anchorX - cardWidth / 2, screenWidth - cardWidth - SCREEN_MARGIN),
  );
  const onLayout = (event: LayoutChangeEvent) => setCardWidth(event.nativeEvent.layout.width);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} testID="event-popover-backdrop" />
      <View
        style={[styles.card, {left, top: anchorY + ANCHOR_GAP}]}
        onLayout={onLayout}
        testID="event-marker-popover"
      >
        <ScrollView style={{maxHeight: MAX_ENTRIES_HEIGHT}} scrollEnabled>
          {events.map((event, index) => {
            const expandable = event.description !== null;
            const expanded = expandable && expandedId === event.id;

            return (
              <View key={event.id} style={index > 0 ? styles.entrySpaced : undefined}>
                <TouchableOpacity
                  style={styles.entryFace}
                  onPress={() => setExpandedId(expanded ? null : event.id)}
                  disabled={!expandable}
                  activeOpacity={0.7}
                  accessibilityLabel={`${event.name}, ${expanded ? 'hide' : 'show'} description`}
                >
                  <View>
                    <Text style={styles.name} numberOfLines={1}>{event.name}</Text>
                    <View style={styles.momentRow}>
                      <Text style={styles.moment}>{formatRelativeTime(event.occurredAt)}</Text>
                      {expandable && (
                        <MaterialIcons
                          name={expanded ? 'expand-less' : 'expand-more'}
                          size={16}
                          color={COLORS.onSurfaceVariant}
                        />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {expanded && <Text style={styles.description}>{event.description}</Text>}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    position: 'absolute',
    alignSelf: 'flex-start',
    maxWidth: MAX_WIDTH,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...ELEVATION.dropdown,
  },
  // No rule between entries: this floats over a drawing, and a line ruled across
  // it is one more mark over that.
  entrySpaced: {
    marginTop: 14,
  },
  entryFace: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  moment: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    opacity: 0.7,
  },
  description: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 10,
  },
});
