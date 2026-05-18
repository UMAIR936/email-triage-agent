// src/agent/graph.ts
// Wires all nodes together into a LangGraph StateGraph.

import { StateGraph, END } from '@langchain/langgraph'
import { AgentState } from './state'
import { classifierNode } from './nodes/classifier'
import { routerNode, RouteDecision } from './nodes/router'
import { drafterNode } from './nodes/drafter'
import { snoozeNode } from './nodes/snooze'
import { flagUrgentNode } from './nodes/flag-urgent'
import { getStyleContext } from '../memory/style-store'

// Build the graph
const workflow = new StateGraph<AgentState>({
  channels: {
    userId: { value: (a: string, b: string) => b ?? a },
    email: { value: (a: any, b: any) => b ?? a },
    classification: { value: (a: any, b: any) => b ?? a },
    draft: { value: (a: any, b: any) => b ?? a },
    styleContext: { value: (a: any, b: any) => b ?? a },
    error: { value: (a: any, b: any) => b ?? a },
  },
})

// Load style context before classification (injected into state for drafter)
async function loadStyleNode(state: AgentState): Promise<Partial<AgentState>> {
  const styleContext = await getStyleContext(state.userId)
  return { styleContext }
}

// Add all nodes
workflow.addNode('load_style', loadStyleNode)
workflow.addNode('classifier', classifierNode)
workflow.addNode('router', routerNode as any)
workflow.addNode('drafter', drafterNode)
workflow.addNode('snooze', snoozeNode)
workflow.addNode('flag_urgent', flagUrgentNode)

// Entry point
workflow.setEntryPoint('load_style')

// Edges
workflow.addEdge('load_style', 'classifier')
workflow.addEdge('classifier', 'router')

// Conditional routing based on router's return value
workflow.addConditionalEdges(
  'router',
  (state: AgentState) => routerNode(state),
  {
    drafter: 'drafter',
    snooze: 'snooze',
    flag_urgent: 'flag_urgent',
    done: END,
  }
)

workflow.addEdge('drafter', END)
workflow.addEdge('snooze', END)
workflow.addEdge('flag_urgent', END)

export const emailAgent = workflow.compile()

// Main entry point — call this for each new email
export async function runAgent(userId: string, email: AgentState['email']) {
  const result = await emailAgent.invoke({ userId, email })
  return result as AgentState
}
