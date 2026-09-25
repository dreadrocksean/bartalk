import { Image as ExpoImage } from "expo-image";
import { Text, TouchableOpacity, View } from "react-native";
import type { MessageLinkPreview } from "../../../types/firestore";
import { openLink } from "../../../utils/open-link";
import styles from "../styles";

type LinkPreviewCardProps = {
  preview: MessageLinkPreview;
  onLongPress: () => void;
};

/** The domain, which is what a card's footer says rather than the full URL. */
const domainOf = (preview: MessageLinkPreview) => {
  if (preview.siteName) return preview.siteName;
  const withoutScheme = preview.url.replace(/^https?:\/\//i, "");
  return withoutScheme.split("/")[0].replace(/^www\./i, "");
};

/** An iMessage-style card for a link: picture, headline, and where it goes. */
export const LinkPreviewCard = ({
  preview,
  onLongPress,
}: LinkPreviewCardProps) => (
  <TouchableOpacity
    style={styles.linkPreviewCard}
    activeOpacity={0.85}
    onPress={() => {
      void openLink(preview.url);
    }}
    onLongPress={onLongPress}
  >
    {preview.imageUrl ? (
      <ExpoImage
        source={{ uri: preview.imageUrl }}
        style={styles.linkPreviewImage}
        contentFit="cover"
        transition={140}
      />
    ) : null}
    <View style={styles.linkPreviewBody}>
      {preview.title ? (
        <Text style={styles.linkPreviewTitle} numberOfLines={2}>
          {preview.title}
        </Text>
      ) : null}
      <Text style={styles.linkPreviewDomain} numberOfLines={1}>
        {domainOf(preview)}
      </Text>
    </View>
  </TouchableOpacity>
);
