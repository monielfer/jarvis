/**
 * BaseAgent — foundation class for all JARVIS agents.
 * All specialized agents extend this class.
 */
export class BaseAgent {
  constructor({ name, description, capabilities = [] }) {
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.status = 'idle'; // idle | thinking | executing | error
  }

  /**
   * Execute the agent's primary task.
   * Must be implemented by subclasses.
   * @param {{ task: string, context: object }} input
   * @returns {Promise<{ result: any, metadata: object }>}
   */
  async execute({ task, context = {} }) {
    throw new Error(`Agent "${this.name}" must implement execute()`);
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      status: this.status,
    };
  }
}
