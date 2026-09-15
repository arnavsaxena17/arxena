'use client';

import styled from '@emotion/styled';
import {
  IconBrandLinkedin,
  IconBrandWhatsapp,
  IconCode,
  IconMail,
  IconMailbox,
  IconMessage,
  IconMessageCircle,
  IconNews,
  IconPlayerPause,
  IconPlaylistAdd,
  IconSearch,
  IconSend,
  IconUserPlus,
} from '@tabler/icons-react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

type TablerIconComponent = ComponentType<{
  size?: number | string;
  stroke?: number | string;
  color?: string;
}>;

// Website + Twenty UI tokens (homepage gray scale + workflow icon colors)
const C = {
  bg: '#ffffff',
  card: '#ffffff',
  cardBorder: '#b3b3b3',
  cardBorderLight: 'rgba(20,20,20,0.08)',
  text: '#141414',
  textSecondary: '#818181',
  textTertiary: '#818181',
  accent: '#00a4a4',
  glow: 'rgba(0,164,164,0.28)',
  surface: '#fafafa',
  iconBg: 'rgba(20,20,20,0.06)',
  border: 'rgba(20,20,20,0.08)',
  twRed: '#e5484d',
  twBlue: '#3e63dd',
  twGreen: '#193b2d',
  twTertiary: '#999999',
  // Channel brand colors
  linkedin: '#0A66C2',
  whatsapp: '#25D366',
  gmail: '#EA4335',
  levelColors: [
    '#AC193D',
    '#2672EC',
    '#8C0095',
    '#5133AB',
    '#008299',
    '#D24726',
    '#008A00',
    '#094AB2',
  ],
} as const;

const NODE_W = 150;
const NODE_H = 82;
// Match homepage / layout.css body font
const FONT = 'var(--font-gabarito), system-ui, sans-serif';
const ICON_STROKE = 1.5;

const NARRATIVE_STEPS = ['Map', 'Reach', 'Meet'] as const;

// Loops a boolean on/off while the graphic stays in view (pauses off-screen)
function useInViewBooleanLoop({
  onMs,
  offMs = 900,
  startDelayMs = 200,
  leadInMs = 400,
  reducedMotionValue = true,
  amount = 0.35,
}: {
  onMs: number;
  offMs?: number;
  startDelayMs?: number;
  leadInMs?: number;
  reducedMotionValue?: boolean;
  amount?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: false, amount });
  const prefersReducedMotion = useReducedMotion();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!isInView) {
      setActive(false);
      return;
    }

    if (prefersReducedMotion) {
      setActive(reducedMotionValue);
      return;
    }

    let cancelled = false;
    const timeoutIds: number[] = [];

    const later = (callback: () => void, delayMs: number) => {
      timeoutIds.push(
        window.setTimeout(() => {
          if (!cancelled) {
            callback();
          }
        }, delayMs),
      );
    };

    const runCycle = () => {
      setActive(false);
      later(() => {
        setActive(true);
        later(() => {
          setActive(false);
          later(runCycle, offMs);
        }, onMs);
      }, leadInMs);
    };

    later(runCycle, startDelayMs);

    return () => {
      cancelled = true;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [
    isInView,
    prefersReducedMotion,
    onMs,
    offMs,
    startDelayMs,
    leadInMs,
    reducedMotionValue,
  ]);

  return { ref, active, prefersReducedMotion, isInView };
}

type OrgChartNodeProps = {
  x: number;
  y: number;
  label: string;
  people?: string[];
  levelColor?: string;
  dimmed?: boolean;
  highlighted?: boolean;
  pulsing?: boolean;
  badge?: string;
};

function OrgChartNode({
  x,
  y,
  label,
  people,
  levelColor = C.cardBorder,
  dimmed = false,
  highlighted = false,
  pulsing = false,
  badge = 'Active',
}: OrgChartNodeProps) {
  const stroke = highlighted ? C.accent : levelColor;
  const strokeWidth = highlighted ? 2.5 : 1.25;

  return (
    <motion.g
      style={{
        opacity: dimmed ? 0.48 : 1,
        transformOrigin: `${x + NODE_W / 2}px ${y + NODE_H / 2}px`,
      }}
      animate={
        pulsing
          ? {
              scale: [1, 1.03, 1],
            }
          : undefined
      }
      transition={
        pulsing
          ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          : undefined
      }
    >
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill={C.card}
        stroke={stroke}
        strokeWidth={strokeWidth}
        filter={highlighted ? `drop-shadow(0 0 10px ${C.glow})` : undefined}
      />
      <rect
        x={x + NODE_W / 2 - 28}
        y={y - 1}
        width={56}
        height={16}
        rx={3}
        fill={highlighted ? C.accent : '#008A00'}
      />
      <text
        x={x + NODE_W / 2}
        y={y + 11}
        textAnchor="middle"
        fontSize={9}
        fill="#fff"
        fontFamily={FONT}
        fontWeight={700}
      >
        {badge}
      </text>
      <text
        x={x + NODE_W / 2}
        y={y + 34}
        textAnchor="middle"
        fontSize={12}
        fill={C.text}
        fontFamily={FONT}
        fontWeight={700}
      >
        {label.length > 18 ? `${label.slice(0, 17)}…` : label}
      </text>
      {people?.slice(0, 2).map((person, index) => (
        <text
          key={`${person}-${index}`}
          x={x + NODE_W / 2}
          y={y + 52 + index * 14}
          textAnchor="middle"
          fontSize={10}
          fill={C.textTertiary}
          fontFamily={FONT}
        >
          {person.length > 20 ? `${person.slice(0, 19)}…` : person}
        </text>
      ))}
    </motion.g>
  );
}

function SvgTablerIcon({
  x,
  y,
  size = 28,
  Icon,
  color,
  withBackground = false,
}: {
  x: number;
  y: number;
  size?: number;
  Icon: TablerIconComponent;
  color: string;
  withBackground?: boolean;
}) {
  const iconSize = Math.round(size * (withBackground ? 0.55 : 0.72));

  return (
    <foreignObject x={x} y={y} width={size} height={size}>
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: withBackground ? 4 : 0,
          background: withBackground ? C.iconBg : 'transparent',
          boxSizing: 'border-box',
        }}
      >
        <Icon size={iconSize} stroke={ICON_STROKE} color={color} />
      </div>
    </foreignObject>
  );
}

const FLAT_TITLE_ROWS = [
  { name: 'Debabrata Gupta', title: 'Director — Operations' },
  { name: 'Khadimhusain Momin', title: 'Head Freight Management' },
  { name: 'Hemant Kekre', title: 'Factory Head' },
  { name: 'Bharat Shah', title: 'Factory Head' },
  { name: 'Sachin Jadhav', title: 'Sr. Project Manager' },
  { name: 'Praveen Singh', title: 'Plant Manager' },
  { name: 'Anand Deshmukh', title: 'Plant Head' },
  { name: 'Amita Bhatia', title: 'Production Manager' },
  { name: 'Ravi Mehta', title: 'Maintenance Manager' },
  { name: 'Neha Kulkarni', title: 'Operations Lead' },
  { name: 'Suresh Patil', title: 'Shift Supervisor' },
  { name: 'Priya Nair', title: 'Quality Lead' },
] as const;

// Names mapped to org-tree slots (resolved to coordinates in TargetingTransformGraphic)
const TITLE_FLIGHT_SLOTS = [
  { name: 'Debabrata Gupta', slot: 'root' },
  { name: 'Khadimhusain Momin', slot: 'root' },
  { name: 'Hemant Kekre', slot: 'root' },
  { name: 'Bharat Shah', slot: 'root' },
  { name: 'Sachin Jadhav', slot: 'project' },
  { name: 'Neha Kulkarni', slot: 'project' },
  { name: 'Praveen Singh', slot: 'plant' },
  { name: 'Anand Deshmukh', slot: 'plant' },
  { name: 'Amita Bhatia', slot: 'production' },
  { name: 'Ravi Mehta', slot: 'maintenance' },
  { name: 'Suresh Patil', slot: 'maintenance' },
  { name: 'Priya Nair', slot: 'plantTeam' },
] as const;

function TargetingTransformGraphic() {
  const {
    ref: containerRef,
    active: mergedIntoChart,
    prefersReducedMotion,
  } = useInViewBooleanLoop({
    onMs: 2800,
    offMs: 1400,
    leadInMs: 1100,
    startDelayMs: 200,
  });

  // Product-like node spacing (NODE_W=150, generous gaps — not clustered)
  const gapX = 28;
  const gapY = 48;
  const chartStartX = 200;
  const midXs = [0, 1, 2, 3].map(
    (index) => chartStartX + index * (NODE_W + gapX),
  );
  const rootX = midXs[0] + (midXs[3] + NODE_W - midXs[0]) / 2 - NODE_W / 2;
  const rootY = 28;
  const midY = rootY + NODE_H + gapY;
  const leafY = midY + NODE_H + gapY;

  const slotPosition = {
    root: { x: rootX + 12, y: rootY + 28 },
    project: { x: midXs[0] + 12, y: midY + 28 },
    plant: { x: midXs[1] + 12, y: midY + 28 },
    production: { x: midXs[2] + 12, y: midY + 28 },
    maintenance: { x: midXs[3] + 12, y: midY + 28 },
    plantTeam: { x: midXs[1] + 12, y: leafY + 28 },
  } as const;

  const listX = 14;
  const listY = 36;
  const rowHeight = 22;
  const chipWidth = 160;
  const showTitles = !mergedIntoChart;

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 960 420"
      role="img"
      aria-label="Flat job titles flying into a readable org chart"
    >
      {/* Product-style org chart — fades in when titles merge into nodes */}
      <motion.g
        initial={false}
        animate={{ opacity: mergedIntoChart ? 1 : 0 }}
        transition={{
          duration: 0.45,
          delay: mergedIntoChart ? 0.25 : 0,
        }}
      >
        <rect
          x={rootX + NODE_W / 2 - 70}
          y={6}
          width={62}
          height={16}
          rx={8}
          fill="#fff"
          stroke={C.cardBorder}
          strokeWidth={1}
        />
        <text
          x={rootX + NODE_W / 2 - 39}
          y={17}
          textAnchor="middle"
          fontSize={9}
          fill={C.text}
          fontFamily={FONT}
          fontWeight={600}
        >
          Pidilite
        </text>
        <rect
          x={rootX + NODE_W / 2 + 2}
          y={6}
          width={88}
          height={16}
          rx={8}
          fill="#fff"
          stroke={C.cardBorder}
          strokeWidth={1}
        />
        <text
          x={rootX + NODE_W / 2 + 46}
          y={17}
          textAnchor="middle"
          fontSize={9}
          fill={C.text}
          fontFamily={FONT}
          fontWeight={600}
        >
          Manufacturing
        </text>

        {/* Tree connectors — teal like product */}
        <path
          d={`M ${rootX + NODE_W / 2},${rootY + NODE_H}
              L ${rootX + NODE_W / 2},${midY - 16}
              M ${midXs[0] + NODE_W / 2},${midY - 16}
              L ${midXs[3] + NODE_W / 2},${midY - 16}
              M ${midXs[0] + NODE_W / 2},${midY - 16} L ${midXs[0] + NODE_W / 2},${midY}
              M ${midXs[1] + NODE_W / 2},${midY - 16} L ${midXs[1] + NODE_W / 2},${midY}
              M ${midXs[2] + NODE_W / 2},${midY - 16} L ${midXs[2] + NODE_W / 2},${midY}
              M ${midXs[3] + NODE_W / 2},${midY - 16} L ${midXs[3] + NODE_W / 2},${midY}`}
          stroke={C.accent}
          strokeWidth={2.5}
          fill="none"
        />
        <path
          d={`M ${midXs[1] + NODE_W / 2},${midY + NODE_H}
              L ${midXs[1] + NODE_W / 2},${leafY}
              M ${midXs[2] + NODE_W / 2},${midY + NODE_H}
              L ${midXs[2] + NODE_W / 2},${leafY}
              M ${midXs[3] + NODE_W / 2},${midY + NODE_H}
              L ${midXs[3] + NODE_W / 2},${leafY}`}
          stroke={C.accent}
          strokeWidth={2}
          fill="none"
          opacity={0.75}
        />

        <OrgChartNode
          x={rootX}
          y={rootY}
          label="Mfg Leadership"
          people={['Debabrata Gupta', 'Khadimhusain Momin']}
          levelColor={C.levelColors[0]}
          badge="Active"
        />
        <OrgChartNode
          x={midXs[0]}
          y={midY}
          label="Project Mgrs"
          people={['Sachin Jadhav', 'Neha Kulkarni']}
          levelColor={C.levelColors[1]}
        />
        <OrgChartNode
          x={midXs[1]}
          y={midY}
          label="Plant Mgmt"
          people={['Praveen Singh', 'Anand Deshmukh']}
          levelColor={C.levelColors[1]}
        />
        <OrgChartNode
          x={midXs[2]}
          y={midY}
          label="Production"
          people={['Amita Bhatia']}
          levelColor={C.levelColors[1]}
        />
        <OrgChartNode
          x={midXs[3]}
          y={midY}
          label="Maintenance"
          people={['Ravi Mehta', 'Suresh Patil']}
          levelColor={C.levelColors[1]}
        />
        <OrgChartNode
          x={midXs[1]}
          y={leafY}
          label="Plant Team"
          people={['Priya Nair', '+ floor ops']}
          levelColor={C.levelColors[2]}
        />
        <OrgChartNode
          x={midXs[2]}
          y={leafY}
          label="Prod Team"
          people={['Shift leads']}
          levelColor={C.levelColors[2]}
        />
        <OrgChartNode
          x={midXs[3]}
          y={leafY}
          label="Maint Team"
          people={['Technicians']}
          levelColor={C.levelColors[2]}
        />
      </motion.g>

      {/* Left stack shell */}
      <motion.g
        initial={false}
        animate={{ opacity: showTitles ? 1 : 0 }}
        transition={{
          duration: 0.3,
          delay: showTitles ? 0.15 : 0.4,
        }}
      >
        <rect
          x={listX - 6}
          y={listY - 24}
          width={chipWidth + 16}
          height={FLAT_TITLE_ROWS.length * rowHeight + 32}
          rx={10}
          fill="#fff"
          stroke={C.cardBorderLight}
          strokeWidth={1.25}
        />
        <text
          x={listX + chipWidth / 2}
          y={listY - 8}
          textAnchor="middle"
          fontSize={10}
          fill={C.textSecondary}
          fontFamily={FONT}
          fontWeight={700}
        >
          Flat job titles
        </text>
      </motion.g>

      {/* Title chips — continuous fly in / fly back loop */}
      {TITLE_FLIGHT_SLOTS.map((row, index) => {
        const startY = listY + index * rowHeight;
        const destination = slotPosition[row.slot];

        return (
          <motion.g
            key={row.name}
            initial={{ x: listX, y: startY, opacity: 1 }}
            animate={
              showTitles
                ? { x: listX, y: startY, opacity: 1 }
                : {
                    x: destination.x,
                    y: destination.y,
                    opacity: 0,
                  }
            }
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.7,
              delay: prefersReducedMotion
                ? 0
                : showTitles
                  ? 0.03 * (TITLE_FLIGHT_SLOTS.length - 1 - index)
                  : 0.05 + index * 0.04,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <rect
              width={chipWidth}
              height={18}
              rx={5}
              fill="#fff"
              stroke={C.cardBorderLight}
              strokeWidth={1}
            />
            <text
              x={6}
              y={13}
              fontSize={9}
              fill={C.text}
              fontFamily={FONT}
              fontWeight={700}
            >
              {row.name.length > 15 ? `${row.name.slice(0, 14)}…` : row.name}
            </text>
            <SvgTablerIcon
              x={chipWidth - 16}
              y={3}
              size={12}
              Icon={IconBrandLinkedin}
              color={C.linkedin}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}


type WorkflowIconKind =
  | 'trigger'
  | 'linkedin'
  | 'linkedinConnect'
  | 'whatsapp'
  | 'email'
  | 'wait'
  | 'code'
  | 'search';

const WORKFLOW_ICON_BY_KIND: Record<
  WorkflowIconKind,
  { Icon: TablerIconComponent; color: string }
> = {
  trigger: { Icon: IconPlaylistAdd, color: C.twBlue },
  linkedin: { Icon: IconBrandLinkedin, color: C.twRed },
  linkedinConnect: { Icon: IconUserPlus, color: C.twRed },
  whatsapp: { Icon: IconBrandWhatsapp, color: C.twRed },
  email: { Icon: IconSend, color: C.twRed },
  code: { Icon: IconCode, color: C.twRed },
  wait: { Icon: IconPlayerPause, color: C.twGreen },
  search: { Icon: IconSearch, color: C.twTertiary },
};

function WorkflowIcon({ kind }: { kind: WorkflowIconKind }) {
  const { Icon, color } = WORKFLOW_ICON_BY_KIND[kind];

  return (
    <SvgTablerIcon
      x={0}
      y={0}
      size={28}
      Icon={Icon}
      color={color}
      withBackground
    />
  );
}

function WorkflowNodeCard({
  x,
  y,
  kind,
  typeLabel,
  title,
  delay = 0,
  width = 220,
  visible = true,
}: {
  x: number;
  y: number;
  kind: WorkflowIconKind;
  typeLabel: 'Trigger' | 'Action';
  title: string;
  delay?: number;
  width?: number;
  visible?: boolean;
}) {
  const height = 56;
  const isTrigger = typeLabel === 'Trigger';

  return (
    <motion.g
      initial={false}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0.12, y: 6 }}
      transition={{
        delay: visible ? delay : 0,
        duration: 0.35,
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={C.card}
        stroke={C.border}
        strokeWidth={1}
      />
      <g transform={`translate(${x + 10}, ${y + 14})`}>
        <WorkflowIcon kind={kind} />
      </g>
      <text
        x={x + 46}
        y={y + 22}
        fontSize={10}
        fill={isTrigger ? C.twBlue : C.textSecondary}
        fontFamily={FONT}
        fontWeight={500}
      >
        {typeLabel}
      </text>
      <text
        x={x + 46}
        y={y + 40}
        fontSize={13}
        fill={C.text}
        fontFamily={FONT}
        fontWeight={500}
      >
        {title.length > 24 ? `${title.slice(0, 23)}…` : title}
      </text>
    </motion.g>
  );
}

function WorkflowConnector({
  x,
  y1,
  y2,
}: {
  x: number;
  y1: number;
  y2: number;
}) {
  return (
    <g>
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2 - 5}
        stroke={C.cardBorder}
        strokeWidth={1.5}
      />
      <polygon
        points={`${x},${y2} ${x - 4},${y2 - 6} ${x + 4},${y2 - 6}`}
        fill={C.cardBorder}
      />
    </g>
  );
}

function WorkflowBranchPath({
  fromX,
  fromY,
  toX,
  toY,
  label,
  labelSide,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label: 'if' | 'else';
  labelSide: 'left' | 'right';
}) {
  const midY = fromY + (toY - fromY) * 0.45;
  const path = `M ${fromX},${fromY} C ${fromX},${midY} ${toX},${midY} ${toX},${toY - 5}`;
  const labelX =
    labelSide === 'left'
      ? fromX + (toX - fromX) * 0.35 - 10
      : fromX + (toX - fromX) * 0.35 + 10;

  return (
    <g>
      <path d={path} stroke={C.cardBorder} strokeWidth={1.5} fill="none" />
      <polygon
        points={`${toX},${toY} ${toX - 4},${toY - 6} ${toX + 4},${toY - 6}`}
        fill={C.cardBorder}
      />
      <text
        x={labelX}
        y={fromY + 18}
        textAnchor="middle"
        fontSize={11}
        fill={C.textSecondary}
        fontFamily={FONT}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}

function ReachWorkflowGraphic() {
  const { ref, active } = useInViewBooleanLoop({
    onMs: 3800,
    offMs: 1100,
    leadInMs: 350,
  });

  const nodeWidth = 200;
  const nodeHeight = 56;
  const trunkX = 300;
  const leftX = 90;
  const rightX = 510;
  const trunkCenter = trunkX + nodeWidth / 2;
  const leftCenter = leftX + nodeWidth / 2;
  const rightCenter = rightX + nodeWidth / 2;

  const yTrigger = 16;
  const yFind = 84;
  const yCondition = 152;
  const yBranch1 = 236;
  const yBranch2 = 304;
  const yBranch3 = 372;

  return (
    <svg
      ref={ref}
      viewBox="0 0 800 440"
      role="img"
      aria-label="Branching outreach workflow on Albert Jou"
    >
      <defs>
        <pattern
          id="reachDotGrid"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill={C.cardBorderLight} />
        </pattern>
      </defs>
      <rect width={800} height={440} rx={12} fill={C.surface} />
      <rect width={800} height={440} rx={12} fill="url(#reachDotGrid)" />

      <motion.g
        initial={false}
        animate={{ opacity: active ? 1 : 0.35 }}
        transition={{ duration: 0.3 }}
      >
        <rect
          x={20}
          y={24}
          width={132}
          height={40}
          rx={8}
          fill="#fff"
          stroke={C.accent}
          strokeWidth={1.5}
        />
        <text
          x={86}
          y={42}
          textAnchor="middle"
          fontSize={10}
          fill={C.textSecondary}
          fontFamily={FONT}
          fontWeight={600}
        >
          On this person
        </text>
        <text
          x={86}
          y={56}
          textAnchor="middle"
          fontSize={12}
          fill={C.text}
          fontFamily={FONT}
          fontWeight={700}
        >
          Albert Jou
        </text>
      </motion.g>

      <motion.g
        initial={false}
        animate={{ opacity: active ? 1 : 0.2 }}
        transition={{ duration: 0.35, delay: active ? 0.12 : 0 }}
      >
        <WorkflowNodeCard
          x={trunkX}
          y={yTrigger}
          kind="trigger"
          typeLabel="Trigger"
          title="Albert Jou · VP Eng"
          delay={0.05}
          width={nodeWidth}
          visible={active}
        />
        <WorkflowConnector
          x={trunkCenter}
          y1={yTrigger + nodeHeight}
          y2={yFind}
        />
        <WorkflowNodeCard
          x={trunkX}
          y={yFind}
          kind="search"
          typeLabel="Action"
          title="Find warm path"
          delay={0.1}
          width={nodeWidth}
          visible={active}
        />
        <WorkflowConnector
          x={trunkCenter}
          y1={yFind + nodeHeight}
          y2={yCondition}
        />
        <WorkflowNodeCard
          x={trunkX}
          y={yCondition}
          kind="code"
          typeLabel="Action"
          title="Connection degree == 1?"
          delay={0.15}
          width={nodeWidth}
          visible={active}
        />

        <WorkflowBranchPath
          fromX={trunkCenter}
          fromY={yCondition + nodeHeight}
          toX={leftCenter}
          toY={yBranch1}
          label="if"
          labelSide="left"
        />
        <WorkflowBranchPath
          fromX={trunkCenter}
          fromY={yCondition + nodeHeight}
          toX={rightCenter}
          toY={yBranch1}
          label="else"
          labelSide="right"
        />

        <WorkflowNodeCard
          x={leftX}
          y={yBranch1}
          kind="linkedin"
          typeLabel="Action"
          title="LinkedIn message"
          delay={0.22}
          width={nodeWidth}
          visible={active}
        />
        <WorkflowConnector
          x={leftCenter}
          y1={yBranch1 + nodeHeight}
          y2={yBranch2}
        />
        <WorkflowNodeCard
          x={leftX}
          y={yBranch2}
          kind="whatsapp"
          typeLabel="Action"
          title="Send WhatsApp Message"
          delay={0.28}
          width={nodeWidth}
          visible={active}
        />
        <WorkflowConnector
          x={leftCenter}
          y1={yBranch2 + nodeHeight}
          y2={yBranch3}
        />
        <WorkflowNodeCard
          x={leftX}
          y={yBranch3}
          kind="email"
          typeLabel="Action"
          title="Send Email"
          delay={0.34}
          width={nodeWidth}
          visible={active}
        />

        <WorkflowNodeCard
          x={rightX}
          y={yBranch1}
          kind="linkedinConnect"
          typeLabel="Action"
          title="LinkedIn connect"
          delay={0.22}
          width={nodeWidth}
          visible={active}
        />
        <WorkflowConnector
          x={rightCenter}
          y1={yBranch1 + nodeHeight}
          y2={yBranch2}
        />
        <WorkflowNodeCard
          x={rightX}
          y={yBranch2}
          kind="wait"
          typeLabel="Action"
          title="Wait for accept"
          delay={0.28}
          width={nodeWidth}
          visible={active}
        />
        <WorkflowConnector
          x={rightCenter}
          y1={yBranch2 + nodeHeight}
          y2={yBranch3}
        />
        <WorkflowNodeCard
          x={rightX}
          y={yBranch3}
          kind="linkedin"
          typeLabel="Action"
          title="LinkedIn message"
          delay={0.34}
          width={nodeWidth}
          visible={active}
        />
      </motion.g>
    </svg>
  );
}

function OutreachOutcomeGraphic() {
  const { ref, active } = useInViewBooleanLoop({
    onMs: 3600,
    offMs: 1100,
    leadInMs: 300,
  });

  const channels = [
    { label: 'Email', Icon: IconMail, color: C.gmail },
    { label: 'WhatsApp', Icon: IconBrandWhatsapp, color: C.whatsapp },
    { label: 'LinkedIn posts', Icon: IconNews, color: C.linkedin },
    { label: 'LinkedIn comments', Icon: IconMessageCircle, color: C.linkedin },
    {
      label: 'LinkedIn connects',
      Icon: IconUserPlus,
      color: C.linkedin,
    },
    { label: 'LinkedIn InMail', Icon: IconMailbox, color: C.linkedin },
    { label: 'LinkedIn messages', Icon: IconMessage, color: C.linkedin },
  ] as const;

  const calendarX = 310;
  const calendarY = 48;
  const calendarW = 240;
  const calendarH = 210;
  const cell = 30;
  const days = [
    null,
    null,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    null,
    null,
  ];
  const meetingDay = 14;
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <svg
      ref={ref}
      viewBox="0 0 920 340"
      role="img"
      aria-label="Multi-channel outreach sequences lead to a booked meeting with Albert Jou"
    >
      <defs>
        <pattern
          id="outreachDotGrid"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill={C.cardBorderLight} />
        </pattern>
      </defs>
      <rect width={920} height={340} rx={12} fill={C.surface} />
      <rect width={920} height={340} rx={12} fill="url(#outreachDotGrid)" />

      <text
        x={24}
        y={28}
        fontSize={11}
        fill={C.textSecondary}
        fontFamily={FONT}
        fontWeight={700}
      >
        Multi-touch sequence
      </text>

      {channels.map((channel, index) => {
        const y = 42 + index * 40;

        return (
          <motion.g
            key={channel.label}
            initial={false}
            animate={active ? { opacity: 1, x: 0 } : { opacity: 0.4, x: -4 }}
            transition={{
              delay: active ? 0.04 + index * 0.04 : 0,
              duration: 0.3,
            }}
          >
            <rect
              x={20}
              y={y}
              width={180}
              height={34}
              rx={8}
              fill={C.card}
              stroke={C.border}
              strokeWidth={1}
            />
            <SvgTablerIcon
              x={28}
              y={y + 6}
              size={22}
              Icon={channel.Icon}
              color={channel.color}
            />
            <text
              x={58}
              y={y + 22}
              fontSize={11}
              fill={C.text}
              fontFamily={FONT}
              fontWeight={500}
            >
              {channel.label}
            </text>
          </motion.g>
        );
      })}

      <motion.g
        initial={false}
        animate={
          active ? { opacity: 1, scale: 1 } : { opacity: 0.25, scale: 0.94 }
        }
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        style={{
          transformOrigin: `${calendarX + calendarW / 2}px ${calendarY + calendarH / 2}px`,
        }}
      >
        <rect
          x={calendarX}
          y={calendarY}
          width={calendarW}
          height={calendarH}
          rx={12}
          fill="#fff"
          stroke={C.accent}
          strokeWidth={2}
          filter={`drop-shadow(0 0 12px ${C.glow})`}
        />
        <rect
          x={calendarX}
          y={calendarY}
          width={calendarW}
          height={36}
          rx={12}
          fill={C.accent}
        />
        <rect
          x={calendarX}
          y={calendarY + 20}
          width={calendarW}
          height={16}
          fill={C.accent}
        />
        <text
          x={calendarX + calendarW / 2}
          y={calendarY + 24}
          textAnchor="middle"
          fontSize={13}
          fill="#fff"
          fontFamily={FONT}
          fontWeight={700}
        >
          March 2026
        </text>

        {weekdays.map((day, index) => (
          <text
            key={`${day}-${index}`}
            x={calendarX + 22 + index * cell}
            y={calendarY + 54}
            textAnchor="middle"
            fontSize={10}
            fill={C.textSecondary}
            fontFamily={FONT}
            fontWeight={600}
          >
            {day}
          </text>
        ))}

        {days.map((day, index) => {
          if (day === null) {
            return null;
          }
          const column = index % 7;
          const row = Math.floor(index / 7);
          const cellX = calendarX + 8 + column * cell;
          const cellY = calendarY + 64 + row * cell;
          const isMeeting = day === meetingDay;

          return (
            <g key={day}>
              {isMeeting && (
                <rect
                  x={cellX}
                  y={cellY}
                  width={26}
                  height={26}
                  rx={6}
                  fill={C.accent}
                />
              )}
              <text
                x={cellX + 13}
                y={cellY + 17}
                textAnchor="middle"
                fontSize={11}
                fill={isMeeting ? '#fff' : C.text}
                fontFamily={FONT}
                fontWeight={isMeeting ? 700 : 500}
              >
                {day}
              </text>
            </g>
          );
        })}
      </motion.g>

      <motion.g
        initial={false}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: active ? 0.35 : 0, duration: 0.3 }}
      >
        <rect
          x={330}
          y={274}
          width={200}
          height={28}
          rx={8}
          fill="#fff"
          stroke={C.accent}
          strokeWidth={1.5}
        />
        <text
          x={430}
          y={292}
          textAnchor="middle"
          fontSize={12}
          fill={C.text}
          fontFamily={FONT}
          fontWeight={700}
        >
          Meet Albert · Thu 3:00 PM
        </text>
      </motion.g>

      <motion.g
        initial={false}
        animate={
          active
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: 8, scale: 0.96 }
        }
        transition={{
          delay: active ? 0.55 : 0,
          duration: 0.35,
        }}
        style={{ transformOrigin: '760px 80px' }}
      >
        <rect
          x={600}
          y={42}
          width={280}
          height={58}
          rx={12}
          fill={C.whatsapp}
        />
        <polygon points="720,100 740,112 760,100" fill={C.whatsapp} />
        <SvgTablerIcon
          x={614}
          y={58}
          size={22}
          Icon={IconBrandWhatsapp}
          color="#ffffff"
        />
        <text
          x={760}
          y={66}
          textAnchor="middle"
          fontSize={14}
          fill="#fff"
          fontFamily={FONT}
          fontWeight={600}
        >
          Albert replied
        </text>
        <text
          x={760}
          y={86}
          textAnchor="middle"
          fontSize={12}
          fill="rgba(255,255,255,0.92)"
          fontFamily={FONT}
        >
          “Happy to chat next week”
        </text>
      </motion.g>

      <OrgChartNode
        x={665}
        y={140}
        label="VP Engineering"
        people={['Albert Jou']}
        levelColor={C.levelColors[1]}
        highlighted
        pulsing={active}
      />

      <motion.g
        initial={false}
        animate={active ? { opacity: 1 } : { opacity: 0.35 }}
        transition={{ delay: active ? 0.7 : 0, duration: 0.3 }}
      >
        <rect
          x={665}
          y={236}
          width={150}
          height={28}
          rx={8}
          fill="#fff"
          stroke={C.accent}
          strokeWidth={1.5}
        />
        <text
          x={740}
          y={254}
          textAnchor="middle"
          fontSize={11}
          fill={C.accent}
          fontFamily={FONT}
          fontWeight={700}
        >
          Meeting set up
        </text>
      </motion.g>
    </svg>
  );
}

const NarrativeContainer = styled.section`
  width: 100%;
  position: relative;
  background: ${C.bg};
  border-top: 1px solid ${C.border};
  font-family: ${FONT};
  color: ${C.text};
`;

const ActSection = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: minmax(240px, 0.38fr) minmax(0, 0.62fr);
  align-items: center;
  gap: 24px 32px;
  padding: 40px 40px;
  box-sizing: border-box;
  position: relative;
  scroll-margin-top: 72px;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 809px) {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 32px 20px;
  }
`;

const ActContent = styled.div`
  width: 100%;
  text-align: left;
  flex-shrink: 0;

  @media (max-width: 809px) {
    text-align: center;
  }
`;

const ActLabel = styled(motion.p)`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${C.textSecondary};
  margin: 0 0 10px 0;
`;

const StepRail = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin: 0 0 16px 0;

  @media (max-width: 809px) {
    justify-content: center;
  }
`;

const StepRailItem = styled.span<{ $active: boolean }>`
  font-size: 11px;
  font-weight: ${(props) => (props.$active ? 600 : 500)};
  color: ${(props) => (props.$active ? C.accent : C.textSecondary)};
  letter-spacing: 0.02em;

  &::after {
    content: '·';
    margin-left: 10px;
    color: ${C.cardBorderLight};
    font-weight: 400;
  }

  &:last-child::after {
    content: none;
  }
`;

const ActHeadline = styled(motion.h2)`
  font-size: 1.75rem;
  font-weight: 600;
  color: ${C.text};
  margin: 0 0 12px 0;
  line-height: 1.3;

  @media (max-width: 809px) {
    font-size: 1.4rem;
  }
`;

const ActBody = styled(motion.p)`
  font-size: 15px;
  color: ${C.textSecondary};
  line-height: 1.65;
  max-width: 360px;
  margin: 0;

  @media (max-width: 809px) {
    max-width: 520px;
    margin: 0 auto;
  }
`;

const GraphicPanel = styled(motion.div)`
  width: 100%;
  min-width: 0;

  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`;

// Never leave copy fully invisible mid-scroll
const fadeUp = {
  initial: { opacity: 0.55, y: 10 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
};

const ActCopy = ({
  label,
  stepIndex,
  headline,
  body,
}: {
  label: string;
  stepIndex: number;
  headline: ReactNode;
  body: string;
}) => (
  <ActContent>
    <ActLabel {...fadeUp}>{label}</ActLabel>
    <StepRail aria-label="Narrative progress">
      {NARRATIVE_STEPS.map((step, index) => (
        <StepRailItem key={step} $active={index === stepIndex}>
          {step}
        </StepRailItem>
      ))}
    </StepRail>
    <ActHeadline {...fadeUp} transition={{ delay: 0.04 }}>
      {headline}
    </ActHeadline>
    <ActBody {...fadeUp} transition={{ delay: 0.08 }}>
      {body}
    </ActBody>
  </ActContent>
);

export const OrgChartNarrative = () => {
  return (
    <NarrativeContainer>
      <ActSection>
        <ActCopy
          label="Act 1 — Targeting at scale"
          stepIndex={0}
          headline={
            <>
              The most accurate targeting
              <br />
              system at scale.
            </>
          }
          body="Scattered titles become a live org you can actually sell into."
        />
        <GraphicPanel {...fadeUp} transition={{ delay: 0.06 }}>
          <TargetingTransformGraphic />
        </GraphicPanel>
      </ActSection>

      <ActSection>
        <ActCopy
          label="Act 2 — The Reach"
          stepIndex={1}
          headline={
            <>
              Outreach runs as a workflow
              <br />
              over a multi-week follow-up sequence.
            </>
          }
          body="Every touch timed and tracked on Albert — LinkedIn connects and messages, email, WhatsApp, and more — in your voice, with org-graph context."
        />
        <GraphicPanel {...fadeUp} transition={{ delay: 0.06 }}>
          <ReachWorkflowGraphic />
        </GraphicPanel>
      </ActSection>

      <ActSection>
        <ActCopy
          label="Act 3 — The Meeting"
          stepIndex={2}
          headline={
            <>
              Replies land across channels.
              <br />
              The meeting gets booked.
            </>
          }
          body="Capture replies from email, WhatsApp, and LinkedIn — posts, comments, connects, InMail, and messages — then the calendar fills."
        />
        <GraphicPanel {...fadeUp} transition={{ delay: 0.06 }}>
          <OutreachOutcomeGraphic />
        </GraphicPanel>
      </ActSection>
    </NarrativeContainer>
  );
};
