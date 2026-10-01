import type { RoleGuide } from "../gate";
import { bookerSections } from "./bookers";

export const facultyGuide: RoleGuide = {
  title: "Faculty guide",
  welcome: "Book equipment, fund your group's wallet and manage the students who book against it.",
  sections: bookerSections,
};
