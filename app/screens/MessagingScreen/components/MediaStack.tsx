import { Text, TouchableOpacity, View } from "react-native";
import type { MessageMedia } from "../../../types/firestore";
import {
  MEDIA_STACK_LAYER_OFFSET_PX,
  MEDIA_STACK_LAYER_ROTATION_DEG,
  MEDIA_STACK_LAYER_SCALE_STEP,
  MEDIA_STACK_VISIBLE_LAYERS,
} from "../constants";
import styles from "../styles";
import { MediaTile } from "./MediaTile";

type MediaStackProps = {
  media: MessageMedia[];
  onPress: (index: number) => void;
};

/** A square-ish card is the shape a fan reads best in; a single attachment keeps its own. */
const STACK_ASPECT_RATIO = 1;

const aspectRatioOf = (media: MessageMedia) =>
  media.width && media.height && media.height > 0
    ? media.width / media.height
    : 1;

/**
 * Several attachments drawn as a fanned stack: the first one face-on, up to two
 * more splayed out behind it, and the total in a badge on the corner. One
 * attachment falls through to a plain tile, which is what every message sent
 * before this feature looks like.
 */
export const MediaStack = ({ media, onPress }: MediaStackProps) => {
  if (media.length === 0) return null;

  if (media.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(0)}>
        <MediaTile
          media={media[0]}
          style={{ aspectRatio: aspectRatioOf(media[0]) }}
        />
      </TouchableOpacity>
    );
  }

  // Painted back to front, so the item the sender picked first ends up on top.
  const layers = media.slice(0, MEDIA_STACK_VISIBLE_LAYERS);
  const backToFront = layers.map((item, index) => ({
    item,
    // 0 is the front card, larger numbers sit further back in the fan.
    depth: index,
  }));
  backToFront.reverse();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(0)}
      style={[styles.mediaStack, { aspectRatio: STACK_ASPECT_RATIO }]}
    >
      {backToFront.map(({ item, depth }) => (
        <View
          key={`${item.storagePath || item.url}-${depth}`}
          style={[
            styles.mediaStackLayer,
            {
              transform: [
                // Alternating sides give the fan its spread instead of a lean.
                {
                  rotate: `${
                    depth === 0
                      ? 0
                      : (depth % 2 === 1 ? 1 : -1) *
                        MEDIA_STACK_LAYER_ROTATION_DEG *
                        Math.ceil(depth / 2)
                  }deg`,
                },
                { translateY: depth * MEDIA_STACK_LAYER_OFFSET_PX },
                { scale: 1 - depth * MEDIA_STACK_LAYER_SCALE_STEP },
              ],
              zIndex: MEDIA_STACK_VISIBLE_LAYERS - depth,
            },
          ]}
        >
          <MediaTile
            media={item}
            style={styles.mediaStackLayerImage}
            showVideoChrome={depth === 0}
          />
        </View>
      ))}
      <View style={styles.mediaStackCountBadge}>
        <Text style={styles.mediaStackCountText}>{media.length}</Text>
      </View>
    </TouchableOpacity>
  );
};
