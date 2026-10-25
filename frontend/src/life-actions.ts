import { serverNow } from "./server-time";

/** Short public gestures survive position updates and can be rendered by every client. */
export type LifeAction = {
  pose: string;
  topic?: string;
  text?: string;
  startedAt?: number;
  until: number;
};
export type VisibleLife = {
  lifeAction?: LifeAction | null;
  activity?: string;
  activitySlot?: { pose: string } | null;
  busyUntil?: number | null;
  busyLabel?: string | null;
  busyKind?: string | null;
  needs?: { energy?: number; hunger?: number; hygiene?: number };
};
export function activeLifeAction(person: VisibleLife) {
  const action = person.lifeAction;
  return action && action.until > serverNow() ? action : null;
}
export function lifePose(person: VisibleLife): string {
  const gesture = activeLifeAction(person);
  if (gesture) return gesture.pose;
  const action = (person.busyLabel || person.activity || "").toLowerCase();
  if (/sleep|nap|lie/.test(action)) return "Sleep";
  if (/shower|wash/.test(action)) return "Shower";
  if (/cook|prepare/.test(action)) return "Cook";
  if (person.activitySlot?.pose) return person.activitySlot.pose;
  if (
    /eat|meal|food|lunch|dinner|breakfast/.test(action) ||
    person.busyKind === "food"
  )
    return "Eat";
  if (/dance/.test(action)) return "Dance";
  if (/read|book|library/.test(action)) return "Read";
  if (/study|class|lecture|sketch/.test(action)) return "Read";
  if (/type|work|code|co-work|hackathon/.test(action)) return "Type";
  if (/see a band|concert|listen|watch|catch a game|show/.test(action)) return "Listen";
  if (/cheer|perform|sing/.test(action)) return "Cheer";
  if (/photo|tour|people-watch|sightsee/.test(action)) return "Photo";
  if (/phone|call/.test(action)) return "Phone";
  if (/shop|browse|market|dig for|records/.test(action)) return "Browse";
  if (/play|game|arcade|skee|golf|shoot around/.test(action)) return "Play";
  if (/yoga|stretch/.test(action)) return "Yoga";
  if (/train|gym|exercise|workout/.test(action)) return "Exercise";
  if (/wave|greet/.test(action)) return "Wave";
  if (/talk|hang|chat|social|network|meet/.test(action)) return "Talk";
  if (/sit|picnic|reflect/.test(action)) return "Sit";
  if (/jog|run|bike|cycle/.test(action)) return "Jog";
  if (/walk/.test(action)) return "Walk";
  return person.busyUntil ? "Interact" : "Idle";
}
export function lifeLabel(person: VisibleLife) {
  const action = activeLifeAction(person);
  if (action)
    return action.pose === "Wave"
      ? "Waving"
      : action.pose === "Talk"
        ? "Chatting"
        : action.text || action.pose;
  if (person.busyLabel) return person.busyLabel;
  const pose = lifePose(person);
  return (
    (
      {
        Sleep: "Sleeping",
        Shower: "Showering",
        Cook: "Cooking",
        Eat: "Eating",
        Type: "Working",
        Cheer: "Cheering",
        Dance: "Dancing",
        Wave: "Waving",
        Talk: "Chatting",
        Sit: "Sitting",
        Jog: "Jogging",
        Walk: "Walking",
        Interact: "Busy",
      } as Record<string, string>
    )[pose] ?? ""
  );
}
export function lifeTopic(person: VisibleLife) {
  const action = activeLifeAction(person);
  if (action?.topic) return action.topic;
  const pose = lifePose(person);
  return (
    (
      {
        Eat: "food",
        Cook: "food",
        Shower: "water",
        Sleep: "sleep",
        Type: "work",
        Cheer: "music",
        Dance: "music",
        Wave: "friendship",
        Talk: "chat",
      } as Record<string, string>
    )[pose] ?? "chat"
  );
}
