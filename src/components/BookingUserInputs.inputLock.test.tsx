// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/lib/api", () => ({ apiClient: {} }));

import { BookingUserInputs, type InputFieldDef } from "@/components/BookingUserInputs";
import SampleSetsEditor, { type SampleSetField } from "@/components/SampleSetsEditor";
import { isInputLockedForViewer, LOCKED_INPUT_HINT, lockedInputKeys } from "@/lib/inputEditLock";

const fields: InputFieldDef[] = [
  { field_key: "A", field_label: "No. of Samples", field_type: "NUMERIC", options: [], editing_required: false },
  { field_key: "D", field_label: "Sample description", field_type: "TEXT", editing_required: true },
  { field_key: "comments", field_label: "Any Other Requirements:", field_type: "TEXT", editing_required: true },
];
const values = { A: 3, D: "Powder", comments: "" };

/** The booking's `viewer_can_edit_locked_inputs` per role, as the server computes it. */
const ROLE_CAN_EDIT_LOCKED: Record<string, boolean> = {
  "booking user": false,
  supervisor: false,
  "lab operator": false,
  finance: false,
  "OIC of other equipment": false,
  "Department Administrator of another department": false,
  "OIC of this equipment": true,
  "active temporary OIC": true,
  "Department Administrator of this department": true,
  "Main Administrator": true,
};

const openEditor = (canEditLockedInputs: boolean) => {
  render(
    <BookingUserInputs
      inputValues={values}
      inputFields={fields}
      editableInputFields={fields}
      status="BOOKED"
      onUpdate={async () => undefined}
      canEditLockedInputs={canEditLockedInputs}
    />,
  );
  fireEvent.click(screen.getByTitle("Edit user inputs"));
};

afterEach(cleanup);

describe("inputs without 'Editing required'", () => {
  it.each(Object.entries(ROLE_CAN_EDIT_LOCKED))("%s may change them: %s", (_role, canEdit) => {
    expect(isInputLockedForViewer(fields[0], canEdit)).toBe(!canEdit);
    expect(isInputLockedForViewer(fields[1], canEdit)).toBe(false);
    expect(isInputLockedForViewer(fields[2], canEdit)).toBe(false);
    expect([...lockedInputKeys(fields, canEdit)]).toEqual(canEdit ? [] : ["A"]);
  });

  it("are read-only with the lock hint for viewers without the right", () => {
    openEditor(false);
    const locked = screen.getByTestId("locked-input-A");
    expect(locked.textContent).toContain("3");
    expect(locked.textContent).toContain(LOCKED_INPUT_HINT);
    expect(document.querySelector("input#edit-A")).toBeNull();
    expect((document.querySelector("input#edit-D") as HTMLInputElement | null)?.value).toBe("Powder");
  });

  it("stay editable for the OIC, own-department Dept Admin and Main Administrator", () => {
    openEditor(true);
    expect(screen.queryByTestId("locked-input-A")).toBeNull();
    expect(screen.queryByText(LOCKED_INPUT_HINT)).toBeNull();
    expect(document.querySelector("#edit-A")).not.toBeNull();
    expect(document.querySelector("input#edit-D")).not.toBeNull();
  });

  it("are read-only inside extra sample sets too, and set 1 values cannot be copied over them", () => {
    const setFields = fields.slice(0, 2) as SampleSetField[];
    const sets = [{ A: 2, D: "Film" }];
    const lockedView = render(
      <SampleSetsEditor
        fields={setFields}
        sets={sets}
        onChange={() => {}}
        primaryValues={values}
        lockedFieldKeys={new Set(["A"])}
      />,
    );
    expect(screen.getByTestId("locked-input-A").textContent).toContain("2");
    expect(screen.getByTestId("locked-input-A").textContent).toContain(LOCKED_INPUT_HINT);
    expect(document.querySelector("input#sample-set-0-A")).toBeNull();
    expect((document.querySelector("input#sample-set-0-D") as HTMLInputElement | null)?.value).toBe("Film");
    expect(screen.getByLabelText("Copy sample set 1 values into Sample set 2").hasAttribute("disabled")).toBe(true);
    lockedView.unmount();

    render(<SampleSetsEditor fields={setFields} sets={sets} onChange={() => {}} primaryValues={values} />);
    expect(screen.queryByTestId("locked-input-A")).toBeNull();
    expect(screen.queryByText(LOCKED_INPUT_HINT)).toBeNull();
    expect(document.querySelector("#sample-set-0-A")).not.toBeNull();
  });
});
