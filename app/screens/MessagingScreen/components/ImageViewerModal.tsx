import { Image as ExpoImage } from "expo-image";
import { Modal, Pressable } from "react-native";
import styles from "../styles";

type ImageViewerModalProps = {
  viewerImageUri: string | null;
  onClose: () => void;
};

export const ImageViewerModal = ({
  viewerImageUri,
  onClose,
}: ImageViewerModalProps) => {
  return (
    <Modal
      visible={Boolean(viewerImageUri)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.imageViewerBackdrop} onPress={onClose}>
        {viewerImageUri ? (
          <ExpoImage
            source={{ uri: viewerImageUri }}
            style={styles.imageViewerImage}
            contentFit="contain"
          />
        ) : null}
      </Pressable>
    </Modal>
  );
};
