'use client';
import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';

let library: Promise<typeof import('mathlive')> | undefined;
function loadMathLive() {
  return (library ??= import('mathlive').then((module) => {
    // CSS imports bundle local fonts with either deployment target.
    module.MathfieldElement.fontsDirectory = null;
    module.MathfieldElement.soundsDirectory = null;
    module.MathfieldElement.computeEngine = null;
    return module;
  }));
}
export function MathInput({
  value,
  onChange,
  label,
  onEnter,
  disabled = false,
}: {
  value: string;
  onChange: (latex: string) => void;
  label: string;
  onEnter?: (latex: string) => void;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const callbacks = useRef({ onChange, onEnter });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    callbacks.current = { onChange, onEnter };
  }, [onChange, onEnter]);
  useEffect(() => {
    let active = true;
    const container = host.current;
    let cleanup = () => {};
    loadMathLive()
      .then(({ MathfieldElement }) => {
        if (!active || !container) return;
        const element = new MathfieldElement();
        element.setAttribute('aria-label', label);
        element.addEventListener(
          'mount',
          () => {
            field.current = element;
            element.menuItems = [];
            element.smartFence = true;
            element.inlineShortcuts = {
              or: '\\;\\text{or}\\;',
              and: '\\;\\text{and}\\;',
              '<=': '\\le',
              '>=': '\\ge',
            };
            element.mathVirtualKeyboardPolicy = 'auto';
            // Use current props even if loading or mounting finished later.
            element.value = container.dataset.value || '';
            element.readOnly = container.dataset.disabled === 'true';
          },
          { once: true },
        );
        const input = () => callbacks.current.onChange(element.getValue('latex'));
        const keydown = (event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && !element.readOnly) {
            event.preventDefault();
            event.stopPropagation();
            callbacks.current.onEnter?.(element.getValue('latex'));
          }
        };
        const beforeInput = (event: InputEvent) => {
          if (
            (event.inputType === 'insertLineBreak' || event.data === 'insertLineBreak') &&
            !element.readOnly
          ) {
            event.preventDefault();
            callbacks.current.onEnter?.(element.getValue('latex'));
          }
        };
        let scrollFrame = 0;
        const keepVisible = () => {
          cancelAnimationFrame(scrollFrame);
          scrollFrame = requestAnimationFrame(() => {
            if (document.activeElement !== element || !window.mathVirtualKeyboard.visible) return;
            const rect = element.getBoundingClientRect();
            const ceiling =
              window.innerHeight - window.mathVirtualKeyboard.boundingRect.height - 16;
            if (rect.bottom > ceiling || rect.top < 16) {
              window.scrollBy({
                top: rect.top - Math.max(16, (ceiling - rect.height) / 2),
                behavior: 'instant',
              });
            }
          });
        };
        const focus = () => {
          window.mathVirtualKeyboard.layouts = [
            {
              label: 'Algebra',
              rows: [
                ['7', '8', '9', '+', '-', '(', ')'],
                ['4', '5', '6', '\\times', '\\frac{#@}{#?}', '\\left|#0\\right|', '[backspace]'],
                ['1', '2', '3', '=', '\\le', '\\ge', '[left]'],
                ['0', '.', 'x', '\\text{or}', '\\text{and}', '[right]', '[hide-keyboard]'],
              ],
            },
            'alphabetic',
          ];
          keepVisible();
        };
        element.addEventListener('input', input);
        element.addEventListener('keydown', keydown, true);
        element.addEventListener('beforeinput', beforeInput);
        element.addEventListener('focusin', focus);
        window.mathVirtualKeyboard.addEventListener('geometrychange', keepVisible);
        container.append(element);
        cleanup = () => {
          element.removeEventListener('input', input);
          element.removeEventListener('keydown', keydown, true);
          element.removeEventListener('beforeinput', beforeInput);
          element.removeEventListener('focusin', focus);
          window.mathVirtualKeyboard.removeEventListener('geometrychange', keepVisible);
          cancelAnimationFrame(scrollFrame);
          element.remove();
          field.current = null;
        };
      })
      .catch((error) => {
        console.error('MathLive could not initialize', error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      cleanup();
    };
  }, [label]);
  useEffect(() => {
    const element = field.current;
    // Do not reset selection or the editor's undo stack on each keystroke.
    if (element && element.value !== value) element.setValue(value, { silenceNotifications: true });
    if (element) element.readOnly = disabled;
  }, [value, disabled]);
  const insert = (latex: string) => {
    const element = field.current;
    if (!element || disabled) return;
    element.focus();
    element.insert(latex);
    callbacks.current.onChange(element.getValue('latex'));
  };
  return (
    <div className="math-entry">
      <div ref={host} data-value={value} data-disabled={disabled} className="math-input-host" />
      {failed && (
        <p role="alert">
          The math keyboard could not load. Reload to try again; your saved working is safe.
        </p>
      )}
      <div className="math-entry-tools" role="group" aria-label={`${label} tools`}>
        <button type="button" disabled={disabled} onClick={() => insert('\\frac{#@}{#?}')}>
          Fraction
        </button>
        <button type="button" disabled={disabled} onClick={() => insert('\\left(#0\\right)')}>
          Parentheses
        </button>
        <button type="button" disabled={disabled} onClick={() => insert('\\left|#0\\right|')}>
          Absolute value
        </button>
        <button type="button" disabled={disabled} onClick={() => insert('\\;\\text{or}\\;')}>
          or
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            field.current?.focus();
            field.current?.executeCommand('undo');
          }}
        >
          Undo typing
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            field.current?.focus();
            field.current?.executeCommand('redo');
          }}
        >
          Redo typing
        </button>
      </div>
    </div>
  );
}
