interface MergeNullableAnchorTestCase {
  name: string;
  baseAnchorValue: string | null;
  userAnchorValue: string | null | undefined;
  expectedAnchorValue: string | null;
}

export function buildMergeNullableAnchorCases(): MergeNullableAnchorTestCase[] {
  return [
    {
      name: 'keeps base anchor when user value is undefined',
      baseAnchorValue: '## LLM-CPP-EOF-OUTPUT',
      userAnchorValue: undefined,
      expectedAnchorValue: '## LLM-CPP-EOF-OUTPUT',
    },
    {
      name: 'allows explicit null to disable anchor',
      baseAnchorValue: '## LLM-CPP-EOF-OUTPUT',
      userAnchorValue: null,
      expectedAnchorValue: null,
    },
    {
      name: 'allows replacing null base anchor with a concrete value',
      baseAnchorValue: null,
      userAnchorValue: '## CUSTOM-EOF',
      expectedAnchorValue: '## CUSTOM-EOF',
    },
  ];
}
