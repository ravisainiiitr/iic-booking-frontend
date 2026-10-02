// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { axeViolations } from "@/test/axe";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

function Transactions({ stackOnMobile = true }: { stackOnMobile?: boolean }) {
  const [rows, setRows] = useState([{ id: "T1", amount: "₹500" }]);
  return (
    <>
      <button type="button" onClick={() => setRows((r) => [...r, { id: "T2", amount: "₹250" }])}>
        Add row
      </button>
      <Table stackOnMobile={stackOnMobile}>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.amount}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2}>End of list</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}

describe("Table stackOnMobile", () => {
  afterEach(cleanup);

  it("labels each cell with its column heading and keeps table roles", () => {
    render(<Transactions />);
    expect(screen.getByText("T1").getAttribute("data-label")).toBe("Reference");
    expect(screen.getByText("₹500").getAttribute("data-label")).toBe("Amount");
    expect(screen.getByText("End of list").getAttribute("data-label")).toBe("");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Reference", "Amount"]);
  });

  it("labels rows added after the first render", async () => {
    render(<Transactions />);
    await act(async () => screen.getByRole("button", { name: "Add row" }).click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(screen.getByText("₹250").getAttribute("data-label")).toBe("Amount");
  });

  it("leaves tables without the prop untouched", () => {
    const { container } = render(<Transactions stackOnMobile={false} />);
    expect(screen.getByText("T1").hasAttribute("data-label")).toBe(false);
    expect(container.querySelector(".table-stack-mobile")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Transactions />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
