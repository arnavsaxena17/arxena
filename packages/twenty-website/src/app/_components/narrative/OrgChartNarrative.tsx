'use client';

import styled from '@emotion/styled';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';

// ─── Palette (matches your org chart) ───────────────────────────────
const C = {
  bg: '#ffffff',
  bgDark: '#0a0a0a',
  card: '#ffffff',
  cardBorder: 'rgb(150,150,150)',
  cardBorderLight: 'rgba(150,150,150,0.3)',
  text: '#0f172a',
  textSecondary: 'rgb(150,150,150)',
  textTertiary: '#64748b',
  link: '#00a4a4',
  accent: '#00a4a4',
  glow: 'rgba(0,164,164,0.25)',
  warmPath: '#00a4a4',
  // Level colors from diagramInit.ts
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

// ─── Org chart node card (SVG-based, matches your UI) ─────────────────
const NODE_W = 140;
const NODE_H = 76;

function OrgChartNode({
  x,
  y,
  label,
  people,
  levelColor = C.cardBorder,
  dimmed = false,
  highlighted = false,
  pulsing = false,
}: {
  x: number;
  y: number;
  label: string;
  people?: string[];
  levelColor?: string;
  dimmed?: boolean;
  highlighted?: boolean;
  pulsing?: boolean;
}) {
  return (
    <motion.g
      style={{ opacity: dimmed ? 0.15 : 1 }}
      animate={
        pulsing
          ? {
              scale: [1, 1.04, 1],
              opacity: [1, 0.85, 1],
            }
          : {}
      }
      transition={
        pulsing
          ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          : {}
      }
    >
      {/* Card background */}
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill={C.card}
        stroke={highlighted ? C.accent : levelColor}
        strokeWidth={highlighted ? 2.5 : 1.5}
        filter={highlighted ? `drop-shadow(0 0 8px ${C.glow})` : 'none'}
      />
      {/* Active tag */}
      <rect
        x={x + NODE_W / 2 - 22}
        y={y - 1}
        width={44}
        height={14}
        rx={3}
        fill={highlighted ? C.accent : '#008A00'}
        opacity={0.9}
      />
      <text
        x={x + NODE_W / 2}
        y={y + 10}
        textAnchor="middle"
        fontSize={8}
        fill="#fff"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={600}
      >
        Active
      </text>
      {/* Team label */}
      <text
        x={x + 10}
        y={y + 28}
        fontSize={11}
        fill={C.text}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={600}
      >
        {label.length > 18 ? label.slice(0, 17) + '…' : label}
      </text>
      {/* People */}
      {people?.slice(0, 2).map((p, i) => (
        <text
          key={i}
          x={x + 10}
          y={y + 46 + i * 13}
          fontSize={9}
          fill={C.textTertiary}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {p.length > 18 ? p.slice(0, 17) + '…' : p}
        </text>
      ))}
      {/* Footer count */}
      {people && (
        <text
          x={x + NODE_W / 2}
          y={y + NODE_H - 5}
          textAnchor="middle"
          fontSize={8}
          fill={C.textSecondary}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {people.length} {people.length === 1 ? 'person' : 'people'}
        </text>
      )}
    </motion.g>
  );
}

// ─── Connector line ──────────────────────────────────────────────────
function Connector({
  x1,
  y1,
  x2,
  y2,
  color = C.cardBorderLight,
  width = 1.5,
  active = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  active?: boolean;
}) {
  const midY = (y1 + y2) / 2;
  return (
    <motion.path
      d={`M ${x1},${y1} L ${x1},${midY} L ${x2},${midY} L ${x2},${y2}`}
      stroke={active ? C.accent : color}
      strokeWidth={active ? 2.5 : width}
      fill="none"
      strokeDasharray={active ? '0' : '0'}
      initial={active ? { pathLength: 0, opacity: 0 } : {}}
      animate={active ? { pathLength: 1, opacity: 1 } : {}}
      transition={active ? { duration: 0.8, ease: 'easeOut' } : {}}
    />
  );
}

// ─── Channel icon badge ──────────────────────────────────────────────
function ChannelBadge({
  x,
  y,
  label,
  color,
  delay,
  visible,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  delay: number;
  visible: boolean;
}) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
    >
      <rect
        x={x}
        y={y}
        width={60}
        height={22}
        rx={5}
        fill="#fff"
        stroke={color}
        strokeWidth={1.5}
      />
      <circle cx={x + 11} cy={y + 11} r={5} fill={color} />
      <text
        x={x + 20}
        y={y + 15}
        fontSize={9}
        fill={C.text}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={500}
      >
        {label}
      </text>
    </motion.g>
  );
}

// ─── Styled wrappers ──────────────────────────────────────────────────
const NarrativeContainer = styled.section`
  width: 100%;
  position: relative;
  background: ${C.bg};
`;

const ActSection = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const ActContent = styled.div`
  max-width: 900px;
  width: 100%;
  padding: 0 24px;
  text-align: center;
  z-index: 10;
`;

const ActLabel = styled(motion.p)`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${C.textSecondary};
  margin: 0 0 12px 0;
`;

const ActHeadline = styled(motion.h2)`
  font-size: 2rem;
  font-weight: 600;
  color: ${C.text};
  margin: 0 0 16px 0;
  line-height: 1.3;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;

  @media (max-width: 809px) {
    font-size: 1.5rem;
  }
`;

const ActBody = styled(motion.p)`
  font-size: 16px;
  color: ${C.textTertiary};
  line-height: 1.7;
  max-width: 520px;
  margin: 0 auto;
`;

const SVGWrapper = styled(motion.div)`
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  position: relative;
`;

// ─── Main component ──────────────────────────────────────────────────
export const OrgChartNarrative = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth scroll progress
  const progress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Act transitions — each act gets ~20% of scroll
  const act1Opacity = useTransform(progress, [0.0, 0.15, 0.2], [1, 1, 0]);
  const act2Opacity = useTransform(progress, [0.15, 0.2, 0.35, 0.4], [0, 1, 1, 0]);
  const act3Opacity = useTransform(progress, [0.35, 0.4, 0.55, 0.6], [0, 1, 1, 0]);
  const act4Opacity = useTransform(progress, [0.55, 0.6, 0.75, 0.8], [0, 1, 1, 0]);
  const act5Opacity = useTransform(progress, [0.75, 0.8, 1.0], [0, 1, 1]);

  // Org chart nodes visibility within act 1 (the "overwhelming" act)
  const nodesOpacity = useTransform(progress, [0.0, 0.05, 0.15], [0, 1, 0.6]);

  // Warm path line draw
  const warmPathProgress = useTransform(progress, [0.2, 0.3], [0, 1]);
  const warmPathOpacity = useTransform(progress, [0.18, 0.22, 0.35, 0.4], [0, 1, 1, 0]);

  // Channel badges visibility (act 3)
  const channelsVisible = useTransform(progress, [0.38, 0.42, 0.55, 0.58], [0, 1, 1, 0]);

  // The "moment" pulse (act 4)
  const momentScale = useTransform(progress, [0.58, 0.65, 0.72], [0, 1.2, 1]);
  const momentOpacity = useTransform(progress, [0.58, 0.62, 0.72, 0.78], [0, 1, 1, 0]);

  // Meeting booked (act 5)
  const meetingOpacity = useTransform(progress, [0.82, 0.88, 1.0], [0, 1, 1]);
  const finalChartOpacity = useTransform(progress, [0.78, 0.85, 1.0], [0, 0.5, 0.3]);

  return (
    <NarrativeContainer ref={containerRef}>
      {/* ─── Act 1: The Problem ─── */}
      <ActSection>
        <motion.div style={{ opacity: act1Opacity, position: 'absolute', inset: 0 }}>
          <SVGWrapper
            style={{ opacity: nodesOpacity, marginTop: '40px' }}
          >
            <svg viewBox="0 0 700 360" style={{ width: '100%', height: 'auto' }}>
              {/* Many dimmed nodes = overwhelming */}
              {ACT1_NODES.map((n, i) => (
                <OrgChartNode
                  key={i}
                  x={n.x}
                  y={n.y}
                  label={n.label}
                  levelColor={n.color}
                  dimmed
                />
              ))}
            </svg>
          </SVGWrapper>
        </motion.div>
        <ActContent>
          <ActLabel
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
          >
            Act 1 — The Problem
          </ActLabel>
          <ActHeadline
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.1 }}
          >
            500 people. 50 titles.
            <br />
            Who actually decides?
          </ActHeadline>
          <ActBody
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.2 }}
          >
            You know the company. You don't know who matters. Every org chart
            looks the same — and every rep wastes their week finding out who to
            talk to.
          </ActBody>
        </ActContent>
      </ActSection>

      {/* ─── Act 2: The Warm Path ─── */}
      <ActSection>
        <motion.div style={{ opacity: act2Opacity, position: 'absolute', inset: 0 }}>
          <SVGWrapper style={{ marginTop: '40px' }}>
            <svg viewBox="0 0 700 360" style={{ width: '100%', height: 'auto' }}>
              {/* Your team on the left */}
              <OrgChartNode x={20} y={140} label="Your Team" people={['You', 'Colleague 1', 'Colleague 2']} levelColor={C.accent} highlighted />
              {/* Target company on the right */}
              <OrgChartNode x={540} y={40} label="CEO Leadership" people={['Rob Liu']} levelColor={C.levelColors[0]} />
              <OrgChartNode x={540} y={140} label="VP Engineering" people={['Albert J.']} levelColor={C.levelColors[1]} highlighted />
              <OrgChartNode x={540} y={240} label="Product Lead" people={['Rahul K.']} levelColor={C.levelColors[2]} />

              {/* Dimmed connectors within target company */}
              <Connector x1={610} y1={116} x2={610} y2={140} />
              <Connector x1={610} y1={216} x2={610} y2={240} />

              {/* Warm path — animated teal line from your team to VP Eng */}
              <motion.path
                d="M 160,178 C 300,178 400,178 540,178"
                stroke={C.warmPath}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                style={{ pathLength: warmPathProgress, opacity: warmPathOpacity }}
              />
              {/* Glow effect on warm path */}
              <motion.path
                d="M 160,178 C 300,178 400,178 540,178"
                stroke={C.warmPath}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                style={{ pathLength: warmPathProgress, opacity: warmPathOpacity as unknown as number }}
                opacity={0.15}
              />
            </svg>
          </SVGWrapper>
        </motion.div>
        <ActContent>
          <ActLabel
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
          >
            Act 2 — The Warm Path
          </ActLabel>
          <ActHeadline
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.1 }}
          >
            Arxena maps the org.
            <br />
            Then it finds your warm path.
          </ActHeadline>
          <ActBody
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.2 }}
          >
            Which of your 12 colleagues has the warmest connection to the
            decision-maker? Arxena surfaces the path — so you reach the right
            person through the right relationship, not the right job title.
          </ActBody>
        </ActContent>
      </ActSection>

      {/* ─── Act 3: Multi-Channel Reach ─── */}
      <ActSection>
        <motion.div style={{ opacity: act3Opacity, position: 'absolute', inset: 0 }}>
          <SVGWrapper style={{ marginTop: '40px' }}>
            <svg viewBox="0 0 700 360" style={{ width: '100%', height: 'auto' }}>
              {/* Target node — pulsing */}
              <OrgChartNode x={280} y={120} label="VP Engineering" people={['Albert Jou']} levelColor={C.levelColors[1]} highlighted pulsing />

              {/* Channel badges stacking to the right */}
              <ChannelBadge x={440} y={90} label="LinkedIn" color="#0A66C2" delay={0} visible={true} />
              <ChannelBadge x={440} y={120} label="Message" color="#0A66C2" delay={0.15} visible={true} />
              <ChannelBadge x={440} y={150} label="WhatsApp" color="#25D366" delay={0.3} visible={true} />
              <ChannelBadge x={440} y={180} label="Email" color="#EA4335" delay={0.45} visible={true} />
              <ChannelBadge x={440} y={210} label="Comment" color="#0A66C2" delay={0.6} visible={true} />

              {/* Sequence bracket */}
              <motion.path
                d="M 430,85 L 425,85 L 425,225 L 430,225"
                stroke={C.textSecondary}
                strokeWidth={1.5}
                fill="none"
                style={{ opacity: channelsVisible }}
              />
            </svg>
          </SVGWrapper>
        </motion.div>
        <ActContent>
          <ActLabel
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
          >
            Act 3 — The Reach
          </ActLabel>
          <ActHeadline
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.1 }}
          >
            One person. Five touches.
            <br />
            One sequence.
          </ActHeadline>
          <ActBody
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.2 }}
          >
            LinkedIn connect. Message. WhatsApp. Email. Comment — in your voice,
            with context from the org graph. Every touch timed, tracked, and
            tied to the person who actually decides.
          </ActBody>
        </ActContent>
      </ActSection>

      {/* ─── Act 4: The Moment ─── */}
      <ActSection>
        <motion.div style={{ opacity: act4Opacity, position: 'absolute', inset: 0 }}>
          <SVGWrapper style={{ marginTop: '40px' }}>
            <svg viewBox="0 0 700 360" style={{ width: '100%', height: 'auto' }}>
              {/* Center node with glow */}
              <OrgChartNode x={280} y={120} label="VP Engineering" people={['Albert Jou']} levelColor={C.levelColors[1]} highlighted />

              {/* Expanding rings */}
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={350}
                  cy={158}
                  r={NODE_W / 2}
                  fill="none"
                  stroke={C.accent}
                  strokeWidth={2}
                  style={{ opacity: momentOpacity }}
                  animate={{
                    r: [NODE_W / 2, NODE_W / 2 + 60],
                    opacity: [0.6, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.6,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* "Replied" notification */}
              <motion.g
                style={{ opacity: momentOpacity, scale: momentScale }}
                transform-origin="350 60"
              >
                <rect
                  x={250}
                  y={30}
                  width={200}
                  height={44}
                  rx={10}
                  fill={C.accent}
                />
                <text
                  x={350}
                  y={56}
                  textAnchor="middle"
                  fontSize={16}
                  fill="#fff"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight={600}
                >
                  They replied ✦
                </text>
              </motion.g>
            </svg>
          </SVGWrapper>
        </motion.div>
        <ActContent>
          <ActLabel
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
          >
            Act 4 — The Moment
          </ActLabel>
          <ActHeadline
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.1 }}
          >
            Then there's a moment.
          </ActHeadline>
          <ActBody
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.2 }}
          >
            The sequence lands. They open it. They read it. They respond — and
            suddenly the org chart isn't a map anymore, it's a conversation.
          </ActBody>
        </ActContent>
      </ActSection>

      {/* ─── Act 5: The Meeting ─── */}
      <ActSection>
        <motion.div style={{ opacity: act5Opacity, position: 'absolute', inset: 0 }}>
          <SVGWrapper style={{ marginTop: '40px' }}>
            <svg viewBox="0 0 700 360" style={{ width: '100%', height: 'auto' }}>
              {/* Full warm path arc — completed */}
              <OrgChartNode x={20} y={140} label="Your Team" people={['You', 'Colleague 1']} levelColor={C.accent} highlighted />
              <OrgChartNode x={540} y={140} label="VP Engineering" people={['Albert Jou']} levelColor={C.levelColors[1]} highlighted />

              {/* Completed warm path — solid teal */}
              <motion.path
                d="M 160,178 C 300,178 400,178 540,178"
                stroke={C.warmPath}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                style={{ pathLength: 1, opacity: meetingOpacity }}
              />

              {/* Calendar / meeting badge in center */}
              <motion.g
                style={{ opacity: meetingOpacity }}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: false }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              >
                <rect
                  x={280}
                  y={130}
                  width={140}
                  height={50}
                  rx={10}
                  fill="#fff"
                  stroke={C.accent}
                  strokeWidth={2}
                />
                <text
                  x={350}
                  y={152}
                  textAnchor="middle"
                  fontSize={11}
                  fill={C.textSecondary}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  Meeting booked
                </text>
                <text
                  x={350}
                  y={170}
                  textAnchor="middle"
                  fontSize={13}
                  fill={C.text}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight={600}
                >
                  Thu 3:00 PM
                </text>
              </motion.g>

              {/* "Deal moves" indicator */}
              <motion.g
                style={{ opacity: meetingOpacity }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ delay: 0.5 }}
              >
                <text
                  x={350}
                  y={280}
                  textAnchor="middle"
                  fontSize={14}
                  fill={C.accent}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight={600}
                >
                  Same effort → More of the right meetings
                </text>
              </motion.g>
            </svg>
          </SVGWrapper>
        </motion.div>
        <ActContent>
          <ActLabel
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
          >
            Act 5 — The Meeting
          </ActLabel>
          <ActHeadline
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ delay: 0.1 }}
          >
            The meeting gets booked.
            <br />
            The deal moves.
          </ActHeadline>
          <ActBody
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.2 }}
          >
            Same effort. More of the right meetings. That's org intelligence —
            and that's why your team's quota goes up while everyone else's
            stays flat.
          </ActBody>
        </ActContent>
      </ActSection>
    </NarrativeContainer>
  );
};

// ─── Act 1 node layout data (the "overwhelming" chart) ───────────────
const ACT1_NODES = [
  { x: 280, y: 20, label: 'CEO Leadership', color: C.levelColors[0] },
  { x: 80, y: 120, label: 'Support Team', color: C.levelColors[1] },
  { x: 200, y: 120, label: 'Accounting', color: C.levelColors[1] },
  { x: 320, y: 120, label: 'Product Team', color: C.levelColors[1] },
  { x: 440, y: 120, label: 'Recruitment', color: C.levelColors[1] },
  { x: 560, y: 120, label: 'CS Leadership', color: C.levelColors[1] },
  { x: 20, y: 230, label: 'Design Team', color: C.levelColors[2] },
  { x: 140, y: 230, label: 'Sales Mgrs', color: C.levelColors[2] },
  { x: 260, y: 230, label: 'Partnerships', color: C.levelColors[2] },
  { x: 380, y: 230, label: 'Sales Team', color: C.levelColors[2] },
  { x: 500, y: 230, label: 'Accounts', color: C.levelColors[2] },
  { x: 620, y: 230, label: 'Unclassified', color: C.levelColors[6] },
  // Extra scattered nodes for overwhelm
  { x: 60, y: 330, label: 'Team A', color: C.levelColors[3] },
  { x: 180, y: 330, label: 'Team B', color: C.levelColors[3] },
  { x: 300, y: 330, label: 'Team C', color: C.levelColors[3] },
  { x: 420, y: 330, label: 'Team D', color: C.levelColors[3] },
  { x: 540, y: 330, label: 'Team E', color: C.levelColors[3] },
] as const;
