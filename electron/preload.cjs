const { contextBridge, ipcRenderer } = require('electron');

const invoke = (name, value) => ipcRenderer.invoke(`deskhelper:${name}`, value);
const listen = (name, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(`deskhelper:${name}`, listener);
  return () => ipcRenderer.removeListener(`deskhelper:${name}`, listener);
};

contextBridge.exposeInMainWorld('deskhelper', {
  list: () => invoke('list'),
  save: (draft) => invoke('save', draft),
  capture: (retention) => invoke('capture', retention),
  pin: (id) => invoke('pin', id),
  remove: (id) => invoke('remove', id),
  undo: () => invoke('undo'),
  copy: (id, tuck = false) => invoke('copy', { id, tuck }),
  hide: () => invoke('hide'),
  quit: () => invoke('quit'),
  info: () => invoke('info'),
  onChange: (callback) => listen('changed', callback),
  onFocusSearch: (callback) => listen('focus-search', callback),
  onError: (callback) => listen('error', callback),
  widgetState: () => invoke('widget-state'),
  expandWidget: (nearCursor = false) => invoke('widget-expand', nearCursor),
  collapseWidget: () => invoke('widget-collapse'),
  hideWidget: () => invoke('widget-hide'),
  widgetActivity: (active) => invoke('widget-activity', active),
  widgetInteract: () => invoke('widget-interact'),
  keepWidgetOpen: (keep) => invoke('widget-keep', keep),
  positionWidget: (position) => invoke('widget-position', position),
  openLibrary: () => invoke('open-library'),
  monitoring: (enabled) => invoke('monitoring', enabled),
  createPocket: (name) => invoke('pocket-create', name),
  renamePocket: (id, name) => invoke('pocket-rename', { id, name }),
  deletePocket: (id) => invoke('pocket-delete', id),
  assignPocket: (id, pocketId) => invoke('pocket-assign', { id, pocketId }),
  queueToggle: (id) => invoke('queue-toggle', id),
  queueMove: (id, direction) => invoke('queue-move', { id, direction }),
  copyNext: () => invoke('queue-next'),
  remind: (id, at) => invoke('remind', { id, at }),
  acknowledgeReminder: (id) => invoke('reminder-ack', id),
  restore: (id) => invoke('restore', id),
  purge: (id) => invoke('purge', id),
  clean: (id, operation, action) => invoke('clean', { id, operation, action }),
  startDrag: (id) => ipcRenderer.send('deskhelper:drag', id),
  onReminder: (callback) => listen('reminder', callback),
  onWidgetState: (callback) => listen('widget-state', callback),
});
