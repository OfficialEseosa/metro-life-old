import { Component, lazy, Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import Hud from "./ui";
import { useStore } from "./store";
const CityScene = lazy(() => import("./scene"));
class CityBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidMount() {
    useStore.setState({ sceneFailed: false });
  }
  componentDidCatch() {
    useStore.setState({ sceneFailed: true });
    if (this.state.attempt === 0) this.retryTimer = setTimeout(this.retry, 350);
  }
  componentWillUnmount() {
    clearTimeout(this.retryTimer);
  }
  retry = () => {
    clearTimeout(this.retryTimer);
    useStore.setState({ sceneFailed: false });
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };
  render() {
    return this.state.failed ? (
      <div className="scene-failure" role="status">
        <strong>
          {this.state.attempt === 0
            ? "Reopening your city…"
            : "The city view needs another moment."}
        </strong>
        {this.state.attempt > 0 && (
          <>
            <p>Your life is saved. You can still use the menus.</p>
            <button onClick={this.retry}>Try city again</button>
            <button onClick={() => location.reload()}>Reload page</button>
          </>
        )}
      </div>
    ) : (
      <div key={this.state.attempt} style={{ position: "absolute", inset: 0 }}>
        {this.props.children}
      </div>
    );
  }
}
export default function App() {
  const load = useStore((s) => s.load),
    travelling = useStore((s) => !!s.sim?.trip);
  useEffect(() => {
    window.dispatchEvent(new Event("metro-mounted"));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // One Canvas for the whole session: changing life, city or taking a trip never
  // tears down the renderer. The ride card covers the hidden city while travelling.
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          visibility: travelling ? "hidden" : "visible",
        }}
        aria-hidden={travelling}
      >
        <CityBoundary>
          <Suspense
            fallback={
              <div className="scene-loading" role="status">
                Opening your city…
              </div>
            }
          >
            <CityScene />
          </Suspense>
        </CityBoundary>
      </div>
      <Hud />
    </div>
  );
}
