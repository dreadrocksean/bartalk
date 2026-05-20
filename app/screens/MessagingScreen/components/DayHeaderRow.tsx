import { Text, View } from "react-native";
import styles from "../styles";

type DayHeaderRowProps = {
  label: string;
};

export const DayHeaderRow = ({ label }: DayHeaderRowProps) => {
  return (
    <View style={styles.dayHeaderRow}>
      <Text style={styles.dayHeaderText}>{label}</Text>
    </View>
  );
};
