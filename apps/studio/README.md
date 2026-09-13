# Bindfly 2 studio shell

This is the runnable Bindfly 2 application boundary in the strangler layout. It is intentionally not a separately published workspace package.

The Stage 10A Studio loads heterogeneous experiment plugins by stable ID. Each plugin supplies its schema, session factory, execution profiles, interaction adapter, durable-state codec and metric descriptors. React remains confined to this application boundary; engine modules do not import it.

Run `pnpm run v2:start` and open `http://localhost:3001`. Use the Experiment selector to switch between Flying Lines and Drooping Lines, and the Runtime selector to compare main-thread and worker execution.
