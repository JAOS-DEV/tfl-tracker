import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThresholdMinutesInput } from "@/components/ThresholdMinutesInput";

describe("ThresholdMinutesInput", () => {
  it("lets the user clear the field while focused and commit a new value on blur", () => {
    const onChange = vi.fn();

    render(
      <ThresholdMinutesInput
        value={12}
        onChange={onChange}
        ariaLabel="Gap threshold"
      />,
    );

    const input = screen.getByLabelText("Gap threshold");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(8);
    expect(input).toHaveValue("8");
  });

  it("restores the previous value when blur happens on an empty field", () => {
    const onChange = vi.fn();

    render(
      <ThresholdMinutesInput
        value={4}
        onChange={onChange}
        ariaLabel="Late threshold"
      />,
    );

    const input = screen.getByLabelText("Late threshold");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("4");
  });

  it("accepts decimal minute thresholds", () => {
    const onChange = vi.fn();

    render(
      <ThresholdMinutesInput
        value={1}
        min={0.1}
        onChange={onChange}
        ariaLabel="Decimal gap threshold"
      />,
    );

    const input = screen.getByLabelText("Decimal gap threshold");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0.5" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0.5);
    expect(input).toHaveValue("0.5");
  });
});
