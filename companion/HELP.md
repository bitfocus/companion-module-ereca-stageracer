## Ereca Stage Racer

This module will connect to Stage Racer 2 devices running firmwares version 3.25
or above. You can connect to any machine in the fiber network, although for best
performance it is recommended to connect directly to the root node.

You can also connect to a simulation environment on https://sim.ereca.fr/ by
setting the host to sim.ereca.fr et using the API token from the website.

### Available functionality

- Routing of all protocols (SDI, audio, GPIO, multiviewer etc...)
- Optional Take/Clear
- Port renaming
- Source tally with multiviewer TSL UMD v5 follow (optional; enable in connection config)

### Source tally / multiviewer TSL

Enable **Enable tally (TSL)** in the connection config. When disabled, no TSL is sent
and multiviewer UMD names are left alone.

The **Set source tally** action sets **red**, **green**, or **amber** on a
source. **State** is an On/Off dropdown that also accepts a variable or expression
resolving to true/false. The module tracks where that source is routed:

- Any destination currently fed by the source inherits the tally.
- For every multiviewer PIP that shows either that source or a destination carrying
  it, a TSL UMD v5 packet is sent to the StageRacer host on **UDP port 9801**.
- The UMD text is the name of whatever is routed into that PIP (source or destination).
- Addressing uses the multiviewer’s configured `tsl_screen` and the PIP frame index

Use this from Companion Triggers (e.g. driven by an incoming TSL listener) so mixer
tally can follow StageRacer routing onto multiviewers.
