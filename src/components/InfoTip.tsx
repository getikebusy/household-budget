import { useEffect, useId, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewInstance,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { measureElementById, subscribePointerDismiss, targetIsWithinIds } from '../lib/pointer-dismiss';
import { WebPortal } from '../lib/web-portal';
import { colors, radius, spacing, typography } from '../theme/tokens';

type InfoTipProps = {
  field: string;
  text: string;
};

type Anchor = { x: number; y: number; width: number; height: number };

const TIP_MAX_WIDTH = 320;
const VIEWPORT_GAP = 8;
const ANCHOR_GAP = 8;

function tipPosition(anchor: Anchor, tipHeight: number, viewportWidth: number, viewportHeight: number) {
  const width = Math.min(TIP_MAX_WIDTH, viewportWidth - VIEWPORT_GAP * 2);
  let left = anchor.x + anchor.width / 2 - width / 2;
  left = Math.max(VIEWPORT_GAP, Math.min(left, viewportWidth - width - VIEWPORT_GAP));
  const below = anchor.y + anchor.height + ANCHOR_GAP;
  const above = anchor.y - ANCHOR_GAP - tipHeight;
  const top = below + tipHeight > viewportHeight - VIEWPORT_GAP && above >= VIEWPORT_GAP ? above : below;
  return { left, top, width };
}

export function InfoTip({ field, text }: InfoTipProps) {
  const reactId = useId().replace(/:/g, '');
  const buttonId = `infotip-${reactId}`;
  const bubbleId = `infotip-bubble-${reactId}`;
  const buttonRef = useRef<ViewInstance>(null);
  const overButton = useRef(false);
  const overTip = useRef(false);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [tipHeight, setTipHeight] = useState(72);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const web = Platform.OS === 'web';

  function measure() {
    if (web) {
      const next = measureElementById(buttonId);
      if (next) {
        setAnchor(next);
        return;
      }
    }
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function show() {
    clearCloseTimer();
    setOpen(true);
    measure();
  }

  function hideIfIdle() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      if (!overButton.current && !overTip.current && !pinned.current) {
        setOpen(false);
      }
    }, 120);
  }

  function dismiss() {
    clearCloseTimer();
    pinned.current = false;
    overButton.current = false;
    overTip.current = false;
    setOpen(false);
  }

  useEffect(() => {
    if (!web || !open) {
      return;
    }
    return subscribePointerDismiss(dismiss, (target) => targetIsWithinIds(target, [buttonId, bubbleId]));
  }, [bubbleId, buttonId, open, web]);

  useEffect(() => () => clearCloseTimer(), []);

  const place = anchor ? tipPosition(anchor, tipHeight, viewportWidth, viewportHeight) : null;
  const bubble = place ? (
    <View
      nativeID={bubbleId}
      accessibilityLiveRegion="polite"
      onLayout={(event) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        if (next !== tipHeight) {
          setTipHeight(next);
        }
      }}
      onPointerEnter={
        web
          ? () => {
              overTip.current = true;
              show();
            }
          : undefined
      }
      onPointerLeave={
        web
          ? () => {
              overTip.current = false;
              hideIfIdle();
            }
          : undefined
      }
      style={[
        styles.bubble,
        web ? styles.bubbleFixed : null,
        { top: place.top, left: place.left, width: place.width },
      ]}>
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  ) : null;

  return (
    <>
      <Pressable
        ref={buttonRef}
        nativeID={buttonId}
        accessibilityRole="button"
        accessibilityLabel={`More info about ${field}`}
        accessibilityHint={text}
        accessibilityState={{ expanded: open }}
        hitSlop={4}
        onFocus={() => {
          pinned.current = true;
          show();
        }}
        onBlur={() => {
          pinned.current = false;
          hideIfIdle();
        }}
        onHoverIn={
          web
            ? () => {
                overButton.current = true;
                show();
              }
            : undefined
        }
        onHoverOut={
          web
            ? () => {
                overButton.current = false;
                hideIfIdle();
              }
            : undefined
        }
        onPress={() => {
          pinned.current = !pinned.current;
          if (pinned.current) {
            show();
          } else if (!overButton.current && !overTip.current) {
            setOpen(false);
          }
        }}
        style={styles.button}>
        <Svg width={18} height={18} viewBox="0 0 18 18">
          <Circle cx={9} cy={9} r={7.25} stroke={colors.accent} strokeWidth={1.5} fill={colors.surface} />
          <Circle cx={9} cy={5.4} r={0.9} fill={colors.accent} />
          <Path d="M9 8.1v5" stroke={colors.accent} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
      {web && open ? <WebPortal>{bubble}</WebPortal> : null}
      {!web ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
          <View style={styles.nativeLayer}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close info" onPress={dismiss} style={styles.nativeDismiss} />
            {bubble}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    marginVertical: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    maxWidth: TIP_MAX_WIDTH,
    backgroundColor: colors.ink,
    borderRadius: radius.input,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
    zIndex: 20,
  },
  bubbleFixed: Platform.select({
    web: { position: 'fixed' as const },
    default: {},
  }),
  bubbleText: {
    fontFamily: typography.family[400],
    fontSize: typography.size[13],
    lineHeight: 18,
    color: colors.surface,
  },
  nativeLayer: {
    flex: 1,
  },
  nativeDismiss: {
    ...StyleSheet.absoluteFill,
  },
});
