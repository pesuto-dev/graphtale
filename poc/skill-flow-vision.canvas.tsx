import {
  H1,
  Pill,
  Row,
  Stack,
  Text,
} from "cursor/canvas";

/**
 * Parked UX mock. Not part of the shipped extension.
 * Live Flow/Catalog shapes live under fixtures/demo-skills/.
 */
export default function SkillFlowVision() {
  return (
    <Stack gap={16} style={{ padding: 20 }}>
      <Row gap={10} align="center">
        <H1 style={{ margin: 0 }}>Graphtale</H1>
        <Pill size="sm" active>
          vision
        </Pill>
      </Row>
      <Text tone="secondary">
        Read-only viewer: Flow is the runtime order of a skill; Catalog is the
        file inventory. This canvas is a parked mock. Open
        fixtures/demo-skills/ in the extension for generated graphs.
      </Text>
    </Stack>
  );
}
