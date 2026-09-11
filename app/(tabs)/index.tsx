import { View } from "react-native";

import { LocationRequired } from "@/components/location-required";

import TrackeesScreen from "../screens/TrackeesScreen";

// The landing screen. Tracking is the thing this app now asks you to be
// deliberate about — who can see you, who is asking, and who has looked — so it
// is what opens, rather than something you have to go and find.
//
// The location gate sits over this tab and not over the app. Chat stays
// reachable: BarTalk is a messaging app too, and a location permission cannot
// be made a condition of reading your messages — App Review would be right to
// object, and so would anyone holding the phone.
const TrackTab = () => (
  <View style={{ flex: 1 }}>
    <TrackeesScreen />
    <LocationRequired />
  </View>
);

export default TrackTab;
