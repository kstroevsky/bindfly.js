export interface ExperimentModule<Definition extends { readonly id: string }> {
	readonly default: Definition
}

export interface ExperimentRegistration<Definition extends { readonly id: string }> {
	readonly id: string
	readonly load: () => Promise<ExperimentModule<Definition>>
}

export interface ExperimentRegistry<Definition extends { readonly id: string }> {
	register(registration: ExperimentRegistration<Definition>): void
	list(): readonly string[]
	load(id: string): Promise<Definition>
}

export const createExperimentRegistry = <Definition extends { readonly id: string }>(): ExperimentRegistry<Definition> => {
	const registrations = new Map<string, ExperimentRegistration<Definition>>()

	return {
		register: (registration) => {
			if (registrations.has(registration.id)) {
				throw new Error(`Experiment '${registration.id}' is already registered.`)
			}

			registrations.set(registration.id, registration)
		},
		list: () => [...registrations.keys()].sort(),
		load: async (id) => {
			const registration = registrations.get(id)
			if (!registration) throw new Error(`Experiment '${id}' is not registered.`)

			const definition = (await registration.load()).default
			if (definition.id !== id) {
				throw new Error(
					`Experiment '${id}' loaded definition ID '${definition.id}'.`,
				)
			}

			return definition
		},
	}
}
