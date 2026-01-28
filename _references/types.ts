type BridgeOrderType = 'PLAY' | 'STOP';
type TimelineStatus = 'NONE' | 'IDLE' | 'GENERATING' | 'PLAYBACK';

type IBridgeOrder = {
  id: string;
  ts: number;
  machineId: string;
  sessionId?: string; // preset: _milki | new: R8F2
  orderType: BridgeOrderType;
};
