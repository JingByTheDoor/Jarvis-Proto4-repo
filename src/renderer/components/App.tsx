import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExecutionState, UIEventCategory } from '../../shared/types';

// ─── Console Event model (UI-side) ─────────────────────────────────
interface ConsoleEvent {
  id: number;
  category: UIEventCategory;
  time: string;
  text: string;
}

const SIDE_TABS = ['Chat', 'Plan', 'Actions', 'Logs'] as const;
type SideTab = (typeof SIDE_TABS)[number];

let eventCounter = 0;

function timeString(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function App(): React.JSX.Element {
  const [booted, setBooted] = useState(false);
  const [state, setState] = useState<ExecutionState>('idle');
  const [events, setEvents] = useState<ConsoleEvent[]>([]);
  const [input, setInput] = useState('');
  const [sideTab, setSideTab] = useState<SideTab>('Chat');
  const [runCount, setRunCount] = useState(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  useEffect(() => {
    const timer = setTimeout(() => {
      setBooted(true);
      addEvent('AGENT', 'JARVIS online. Awaiting operator input.');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to backend events (only when Electron preload is available)
  useEffect(() => {
    if (!window.jarvis) return;

    const unsubEvent = window.jarvis.onEvent((event) => {
      const text = typeof event.payload === 'object'
        ? JSON.stringify(event.payload)
        : String(event.payload);
      const category = eventKindToCategory(event.kind);
      addEvent(category, `[${event.kind}] ${text}`);
    });

    const unsubState = window.jarvis.onStateChange((newState) => {
      setState(newState);
    });

    return () => {
      unsubEvent();
      unsubState();
    };
  }, []);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const addEvent = useCallback((category: UIEventCategory, text: string) => {
    setEvents((prev) => [
      ...prev,
      { id: eventCounter++, category, time: timeString(), text },
    ]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const goal = input.trim();
    if (!goal) return;
    setInput('');
    addEvent('USER', goal);

    if (window.jarvis) {
      setState('preparing_plan');
      try {
        await window.jarvis.submitGoal(goal);
        setRunCount((c) => c + 1);
      } catch (err) {
        addEvent('ERROR', String(err));
        setState('failed');
      }
    } else {
      // Demo mode when not running in Electron
      addEvent('AGENT', `Acknowledged: "${goal}"`);
      addEvent('PLAN', 'No execution backend available (demo mode).');
    }
  }, [input, addEvent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // ─── Boot Screen ─────────────────────────────────────────────────
  if (!booted) {
    return (
      <div className="boot-screen">
        <div className="boot-screen__logo">JARVIS</div>
        <div className="boot-screen__status">initializing systems…</div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────
  return (
    <div className="app-container">
      {/* Top Status Bar */}
      <div className="status-bar">
        <span className="status-bar__title">JARVIS</span>
        <span>
          <StatusChip state={state} />
        </span>
        <span>operator: local</span>
      </div>

      {/* Main Area */}
      <div className="main-area">
        {/* Console */}
        <div className="console-area">
          <div className="console-events">
            {events.map((ev) => (
              <div key={ev.id} className="console-event">
                <span className={`console-event__category cat-${ev.category}`}>
                  {ev.category}
                </span>
                <span className="console-event__time">{ev.time}</span>
                <span className="console-event__text">{ev.text}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          {/* Input Bar */}
          <div className="input-bar">
            <span className="input-bar__prompt">&gt;</span>
            <input
              className="input-bar__field"
              type="text"
              placeholder="Enter a task…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </div>

        {/* Side Rail */}
        <div className="side-rail">
          <div className="side-rail__tabs">
            {SIDE_TABS.map((tab) => (
              <button
                key={tab}
                className={`side-rail__tab ${sideTab === tab ? 'side-rail__tab--active' : ''}`}
                onClick={() => setSideTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="side-rail__content">
            {sideTab === 'Chat' && <p>Operator chat transcript will appear here.</p>}
            {sideTab === 'Plan' && <p>Current plan preview will appear here.</p>}
            {sideTab === 'Actions' && <p>Action list with approval gates will appear here.</p>}
            {sideTab === 'Logs' && <p>Run logs and artifacts will appear here.</p>}
          </div>
        </div>
      </div>

      {/* Telemetry Bar */}
      <div className="telemetry-bar">
        <div className="telemetry-item">
          <span className="telemetry-item__label">state:</span>
          <span className="telemetry-item__value">{state}</span>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-item__label">events:</span>
          <span className="telemetry-item__value">{events.length}</span>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-item__label">runs:</span>
          <span className="telemetry-item__value">{runCount}</span>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-item__label">engine:</span>
          <span className="telemetry-item__value">v0.1.0</span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function StatusChip({ state }: { state: ExecutionState }): React.JSX.Element {
  let cls = 'status-chip status-chip--idle';
  if (state === 'executing_actions' || state === 'preparing_plan') cls = 'status-chip status-chip--active';
  if (state === 'awaiting_approval') cls = 'status-chip status-chip--warning';
  if (state === 'failed' || state === 'aborted') cls = 'status-chip status-chip--error';

  return <span className={cls}>{state.replace(/_/g, ' ')}</span>;
}

function eventKindToCategory(kind: string): UIEventCategory {
  switch (kind) {
    case 'plan_ready': return 'PLAN';
    case 'action_event': return 'STEP';
    case 'tool_output': return 'TOOL';
    case 'approval_needed': return 'WARNING';
    case 'run_complete': return 'RESULT';
    case 'run_error': return 'ERROR';
    default: return 'AGENT';
  }
}
