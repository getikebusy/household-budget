import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type NavIconName = 'home' | 'list' | 'card' | 'sliders' | 'plus';

type NavIconProps = {
  name: NavIconName;
  color: string;
  size?: number;
};

export function NavIcon({ name, color, size = 22 }: NavIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
  };

  if (name === 'home') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Path
          d="M4 11.2L12 4.5l8 6.7V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-8.8z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'list') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Line x1="5" y1="7" x2="19" y2="7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Line x1="5" y1="17" x2="19" y2="17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'card') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Rect
          x="3.5"
          y="5.5"
          width="17"
          height="13"
          rx="2"
          stroke={color}
          strokeWidth={1.8}
        />
        <Line x1="3.5" y1="10" x2="20.5" y2="10" stroke={color} strokeWidth={1.8} />
      </Svg>
    );
  }

  if (name === 'sliders') {
    return (
      <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
        <Line x1="5" y1="7" x2="19" y2="7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx="9" cy="7" r="2" stroke={color} strokeWidth={1.8} fill={color} />
        <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx="15" cy="12" r="2" stroke={color} strokeWidth={1.8} fill={color} />
        <Line x1="5" y1="17" x2="19" y2="17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx="11" cy="17" r="2" stroke={color} strokeWidth={1.8} fill={color} />
      </Svg>
    );
  }

  return (
    <Svg {...common} accessibilityElementsHidden importantForAccessibility="no">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
