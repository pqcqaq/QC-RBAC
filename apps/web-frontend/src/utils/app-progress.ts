type ProgressChannel = 'boot' | 'route' | 'request';

const activeCounts: Record<ProgressChannel, number> = {
  boot: 0,
  route: 0,
  request: 0,
};

let progressValue = 0.22;
let trickleTimer: number | null = null;
let hideTimer: number | null = null;
let bootReady = false;

const getProgressRoot = () => document.getElementById('app-progress');
const getProgressBar = () => document.getElementById('app-progress-bar');
const getBootScreen = () => document.getElementById('app-boot-screen');

const clearHideTimer = () => {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
};

const stopTrickle = () => {
  if (trickleTimer !== null) {
    window.clearInterval(trickleTimer);
    trickleTimer = null;
  }
};

const renderProgress = () => {
  const bar = getProgressBar();
  if (!bar) {
    return;
  }

  bar.style.transform = `scaleX(${progressValue})`;
};

const getActiveCount = () =>
  activeCounts.boot + activeCounts.route + activeCounts.request;

const getCurrentCeiling = () => {
  if (activeCounts.boot > 0) {
    return 0.84;
  }

  if (activeCounts.route > 0) {
    return 0.9;
  }

  return 0.94;
};

const ensureActive = (floor: number) => {
  const root = getProgressRoot();
  if (!root) {
    return;
  }

  clearHideTimer();
  root.classList.add('is-active');

  if (progressValue < floor) {
    progressValue = floor;
    renderProgress();
  }

  if (trickleTimer !== null) {
    return;
  }

  trickleTimer = window.setInterval(() => {
    if (getActiveCount() === 0) {
      return;
    }

    const ceiling = getCurrentCeiling();
    const increment =
      progressValue < 0.34
        ? 0.09
        : progressValue < 0.58
          ? 0.045
          : progressValue < 0.76
            ? 0.022
            : 0.008;

    progressValue = Math.min(
      ceiling,
      progressValue + increment * (0.7 + Math.random() * 0.6),
    );
    renderProgress();
  }, 180);
};

const completeProgress = () => {
  const root = getProgressRoot();
  if (!root) {
    return;
  }

  stopTrickle();
  clearHideTimer();
  progressValue = 1;
  renderProgress();

  hideTimer = window.setTimeout(() => {
    root.classList.remove('is-active');
    progressValue = bootReady ? 0 : 0.22;
    renderProgress();
  }, 240);
};

const beginChannel = (channel: ProgressChannel, floor: number) => {
  activeCounts[channel] += 1;
  ensureActive(floor);
};

const endChannel = (channel: ProgressChannel) => {
  activeCounts[channel] = Math.max(0, activeCounts[channel] - 1);

  if (getActiveCount() === 0) {
    completeProgress();
    return;
  }

  ensureActive(activeCounts.boot > 0 ? 0.28 : activeCounts.route > 0 ? 0.18 : 0.14);
};

export const beginBootProgress = () => {
  beginChannel('boot', 0.28);
};

export const beginRouteProgress = () => {
  beginChannel('route', 0.18);
};

export const endRouteProgress = () => {
  endChannel('route');
};

export const beginRequestProgress = () => {
  beginChannel('request', 0.14);
};

export const endRequestProgress = () => {
  endChannel('request');
};

export const trackRequestProgress = async <T>(task: () => Promise<T>) => {
  beginRequestProgress();

  try {
    return await task();
  } finally {
    endRequestProgress();
  }
};

export const markAppReady = () => {
  if (bootReady) {
    return;
  }

  bootReady = true;
  document.documentElement.setAttribute('data-app-ready', 'true');

  const bootScreen = getBootScreen();
  if (bootScreen) {
    bootScreen.classList.add('is-hidden');
    window.setTimeout(() => {
      bootScreen.remove();
    }, 460);
  }

  endChannel('boot');
};
