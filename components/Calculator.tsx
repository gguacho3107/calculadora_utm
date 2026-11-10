"use client";

import { useEffect, useReducer } from "react";

type Op = "+" | "−" | "×" | "÷";

type State = {
    current: string;
    previous: string | null;
    op: Op | null;
    overwrite: boolean;
    expression: string;
};

type Action =
    | { type: "digit"; value: string }
    | { type: "decimal" }
    | { type: "operator"; value: Op }
    | { type: "equals" }
    | { type: "clear" }
    | { type: "delete" }
    | { type: "negate" }
    | { type: "percent" };

const MAX_DIGITS = 15;

const initialState: State = {
    current: "0",
    previous: null,
    op: null,
    overwrite: false,
    expression: "",
};

function compute(a: number, b: number, op: Op): number {
    switch (op) {
        case "+":
            return a + b;
        case "−":
            return a - b;
        case "×":
            return a * b;
        case "÷":
            return b === 0 ? NaN : a / b;
    }
}

function format(n: number): string {
    if (!Number.isFinite(n)) return "Error";
    // Evita errores de punto flotante (0.1 + 0.2 → 0.3)
    return String(Number(n.toPrecision(12)));
}

function reducer(state: State, action: Action): State {
    const isError = state.current === "Error";

    if (action.type === "clear") return initialState;
    if (isError) return initialState; // cualquier tecla tras un error reinicia

    switch (action.type) {
        case "digit": {
            if (state.overwrite) {
                return { ...state, current: action.value, overwrite: false };
            }
            if (state.current.replace(/[-.]/g, "").length >= MAX_DIGITS) return state;
            return {
                ...state,
                current:
                    state.current === "0" ? action.value : state.current + action.value,
            };
        }

        case "decimal": {
            if (state.overwrite) {
                return { ...state, current: "0.", overwrite: false };
            }
            if (state.current.includes(".")) return state;
            return { ...state, current: state.current + "." };
        }

        case "operator": {
            // Cambiar de operador antes de escribir el segundo número
            if (state.op && state.previous !== null && state.overwrite) {
                return {
                    ...state,
                    op: action.value,
                    expression: `${state.previous} ${action.value}`,
                };
            }
            // Encadenar operaciones: 2 + 3 × → calcula 5 y sigue
            if (state.op && state.previous !== null) {
                const result = format(
                    compute(Number(state.previous), Number(state.current), state.op),
                );
                if (result === "Error") return { ...initialState, current: "Error" };
                return {
                    current: result,
                    previous: result,
                    op: action.value,
                    overwrite: true,
                    expression: `${result} ${action.value}`,
                };
            }
            return {
                current: state.current,
                previous: state.current,
                op: action.value,
                overwrite: true,
                expression: `${state.current} ${action.value}`,
            };
        }

        case "equals": {
            if (!state.op || state.previous === null) return state;
            const result = format(
                compute(Number(state.previous), Number(state.current), state.op),
            );
            return {
                current: result,
                previous: null,
                op: null,
                overwrite: true,
                expression: `${state.previous} ${state.op} ${state.current} =`,
            };
        }

        case "delete": {
            if (state.overwrite) return state;
            const c = state.current;
            if (c.length <= 1 || (c.length === 2 && c.startsWith("-"))) {
                return { ...state, current: "0" };
            }
            return { ...state, current: c.slice(0, -1) };
        }

        case "negate": {
            if (state.current === "0") return state;
            return {
                ...state,
                current: state.current.startsWith("-")
                    ? state.current.slice(1)
                    : "-" + state.current,
            };
        }

        case "percent": {
            return {
                ...state,
                current: format(Number(state.current) / 100),
                overwrite: true,
            };
        }
    }
}

type Key = {
    label: string;
    aria: string;
    action: Action;
    kind: "number" | "function" | "operator" | "equals";
};

const digit = (d: string): Key => ({
    label: d,
    aria: d,
    action: { type: "digit", value: d },
    kind: "number",
});

const op = (value: Op, aria: string): Key => ({
    label: value,
    aria,
    action: { type: "operator", value },
    kind: "operator",
});

const KEYS: Key[] = [
    { label: "C", aria: "Borrar todo", action: { type: "clear" }, kind: "function" },
    { label: "⌫", aria: "Borrar último dígito", action: { type: "delete" }, kind: "function" },
    { label: "%", aria: "Porcentaje", action: { type: "percent" }, kind: "function" },
    op("÷", "Dividir"),
    digit("7"), digit("8"), digit("9"),
    op("×", "Multiplicar"),
    digit("4"), digit("5"), digit("6"),
    op("−", "Restar"),
    digit("1"), digit("2"), digit("3"),
    op("+", "Sumar"),
    { label: "±", aria: "Cambiar signo", action: { type: "negate" }, kind: "function" },
    digit("0"),
    { label: ".", aria: "Punto decimal", action: { type: "decimal" }, kind: "number" },
    { label: "=", aria: "Calcular", action: { type: "equals" }, kind: "equals" },
];

const KEY_STYLES: Record<Key["kind"], string> = {
    number: "bg-zinc-800 text-zinc-50 hover:bg-zinc-700 active:bg-zinc-600",
    function: "bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-500",
    operator:
        "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 active:bg-indigo-500/35",
    equals: "bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600",
};

function keyToAction(e: KeyboardEvent): Action | null {
    if (/^[0-9]$/.test(e.key)) return { type: "digit", value: e.key };
    switch (e.key) {
        case ".":
        case ",":
            return { type: "decimal" };
        case "+":
            return { type: "operator", value: "+" };
        case "-":
            return { type: "operator", value: "−" };
        case "*":
        case "x":
            return { type: "operator", value: "×" };
        case "/":
            return { type: "operator", value: "÷" };
        case "Enter":
        case "=":
            return { type: "equals" };
        case "Backspace":
            return { type: "delete" };
        case "Escape":
        case "Delete":
            return { type: "clear" };
        case "%":
            return { type: "percent" };
        default:
            return null;
    }
}

export default function Calculator() {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const action = keyToAction(e);
            if (!action) return;
            e.preventDefault();
            dispatch(action);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const displaySize =
        state.current.length > 12
            ? "text-3xl"
            : state.current.length > 9
                ? "text-4xl"
                : "text-5xl";

    return (
        <div className="w-full max-w-sm rounded-3xl bg-zinc-900 p-5 shadow-2xl shadow-black/60 ring-1 ring-zinc-800">
            <div
                className="mb-4 flex min-h-[7rem] flex-col items-end justify-end gap-1 overflow-hidden rounded-2xl bg-zinc-950 px-5 py-4"
                role="status"
                aria-live="polite"
            >
                <div className="h-6 text-sm text-zinc-500">{state.expression}</div>
                <div
                    className={`max-w-full truncate font-mono font-light tabular-nums ${displaySize} ${
                        state.current === "Error" ? "text-rose-400" : "text-zinc-50"
                    }`}
                >
                    {state.current}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
                {KEYS.map((key) => (
                    <button
                        key={key.label}
                        type="button"
                        aria-label={key.aria}
                        onClick={() => dispatch(key.action)}
                        className={`h-16 rounded-2xl text-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${KEY_STYLES[key.kind]}`}
                    >
                        {key.label}
                    </button>
                ))}
            </div>
        </div>
    );
}