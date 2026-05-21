// src/agent/graph.ts
import { StateGraph, END } from '@langchain/langgraph'
import { AgentState } from './state'
import { classifierNode } from './nodes/classifier'
import { routerNode, RouteDecision } from './nodes/router'
import { drafterNode } from './nodes/drafter'
import { snoozeNode } from './nodes/snooze'
import { flagUrgentNode } from './nodes/flag-urgent'
import { getStyleContext } from '../memory/style-store'

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

async function loadStyleNode(state: AgentState): Promise<Partial<AgentState>> {
  const styleContext = await getStyleContext(state.userId)
  return { styleContext }
}

workflow.addNode('load_style', loadStyleNode)
workflow.addNode('classifier', classifierNode)
workflow.addNode('drafter', drafterNode)
workflow.addNode('snooze', snoozeNode)
workflow.addNode('flag_urgent', flagUrgentNode)

workflow.setEntryPoint('load_style')

workflow.addEdge('load_style', 'classifier')

// routerNode used only as a condition function, not a node
workflow.addConditionalEdges(
  'classifier',
  async (state: AgentState): Promise<RouteDecision> => {
    return await routerNode(state) as RouteDecision
  },
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

export async function runAgent(userId: string, email: AgentState['email']) {
  const result = await emailAgent.invoke({ userId, email })
  return result as AgentState
}