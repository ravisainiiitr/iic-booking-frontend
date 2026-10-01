import type { RoleGuide } from "../gate";
import { bookerSections } from "./bookers";

export const studentGuide: RoleGuide = {
  title: "Student guide",
  welcome: "Book equipment against your supervisor's wallet, track your samples and download results.",
  sections: bookerSections,
};
