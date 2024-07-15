import { createState } from "twenty-ui";

export const currentUnreadMessagesState = createState<number>({
  defaultValue: 0,
  key: "currentUnreadMessagesState",
});
