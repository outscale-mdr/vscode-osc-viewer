//
// ARM Viewer - VS Code Extension
// Ben Coleman, 2019
// Client script runs inside webview and renders parsed results in a Cytoscape panel
//

// Globals
let cy                     // Global cytoscape instance
let vscode                 // VS Code API instance, can only be fetched once
let labelField = 'label'   // Which field to show in labels
let imagePrefix


//
// Initialize the Cytoscope container, and send message we're done
//
function init(prefix) {
  imagePrefix = prefix
  // Important step initializes main Cytoscape object 'cy'

  cy = cytoscape({
    container: document.getElementById('mainview'),
    wheelSensitivity: 0.15,
    maxZoom: 5,
    //minZoom: 0.2,
    selectionType: 'single',
  })

  // Handle selection events
  cy.on('select', evt => {
    // Only work with nodes, user can't select edges/arrows
    if (evt.target.isNode()) {

      // Force selection of single nodes only
      if (cy.$('node:selected').length > 1) {
        cy.$('node:selected')[0].unselect()
      }

      document.getElementById('details').disabled = false

    }
  })


  // Send message that we're initialized and ready for data
  vscode = acquireVsCodeApi()
  vscode.postMessage({ command: 'initialized' })
}

//
// Called with new or refreshed data
//
function displayData(data) {
  cy.remove('*')
  cy.add(data)

  reLayout(false)
}

//
// Layout the view of nodes given current data
//
function reLayout() {
  // Set colors in keeping with VS code theme (might be dark or light)
  const bgColor = window.getComputedStyle(document.getElementsByTagName('html')[0]).getPropertyValue('--vscode-checkbox-background')
  let textColor = '#eeeeee'
  let lineColor = '#777777'
  const borderColor = window.getComputedStyle(document.getElementsByTagName('button')[0]).getPropertyValue('background-color')
  const textColorOutline = bgColor
  if (document.getElementsByTagName('body')[0].classList.contains('vscode-light')) {
    textColor = '#222222'
    lineColor = '#000'
  }


  // Style of nodes, i.e. resources.
  cy.style().selector('node').style({
    'background-opacity': 0,
    'label': node => { return decodeURIComponent(node.data(labelField)) },
    'background-image': node => { return imagePrefix + '/node/' + node.data('img') },
    'background-width': '100%',
    'background-height': '100%',
    'shape': 'roundrectangle',
    'width': '300px',
    'height': '300px',
    'border-width': '0',
    'font-family': 'system-ui',
    'color': textColor,
    'text-valign': 'bottom',
    'text-margin-y': '10vh',
    'font-size': '70%',
    'text-outline-color': textColorOutline,
    'text-outline-width': '10%'
  })

  // Bounding box for selected nodes
  cy.style().selector('node:selected').style({
    'border-width': '4',
    'border-color': borderColor
  })

  // Edges are arrows between resources
  cy.style().selector('edge').style({
    'target-arrow-shape': 'triangle',
    'curve-style': 'unbundled-bezier',
    'width': 10,
    'line-color': lineColor,
    'arrow-scale': '1.5',
    'target-arrow-color': lineColor,
    //'opacity': 0.6,
    'label': node => { return decodeURIComponent(node.data(labelField)) },
    'display': 'element',
    'font-size': '70%',
    'font-family': 'system-ui',
  })

  // Bounding box for groups
  cy.style().selector(':parent').style({
    'background-image': node => { return imagePrefix + '/parent/' + node.data('img') },
    'label': node => { return getLabel(node) }, //decodeURIComponent(node.data(labelField)) },
    'font-family': 'system-ui',
    'font-size': '70%',
    'text-outline-color': textColorOutline,
    'text-outline-width': '10%',
    'color': textColor,
    'text-valign': 'bottom',
    'text-halign': 'center',
    'min-height': '400px',
    'padding': '2%',
    'text-margin-y': '50px',
    'compound-sizing-wrt-labels': 'include'
  })

  // Set up snap to grid
  cy.snapToGrid({ gridSpacing: 200, lineWidth: 3, drawGrid: false })

  // Re-layout nodes in given mode, resizing and fitting too
  cy.style().update()
  //cy.resize()


  cy.layout({
    name: 'cose-bilkent',
    quality: 'default',
    // Whether to include labels in node dimensions. Useful for avoiding label overlap
    nodeDimensionsIncludeLabels: true,
    // number of ticks per frame; higher is faster but more jerky
    refresh: 30,
    // Whether to fit the network view after when done
    fit: true,
    // Padding on fit
    padding: 0,
    // Whether to enable incremental mode
    randomize: true,
    // Node repulsion (non overlapping) multiplier
    nodeRepulsion: 4500,
    // Ideal (intra-graph) edge length
    idealEdgeLength: 50,
    // Divisor to compute edge forces
    edgeElasticity: 0.45,
    // Nesting factor (multiplier) to compute ideal edge length for inter-graph edges
    nestingFactor: 0.1,
    // Gravity force (constant)
    gravity: 0.25,
    // Maximum number of iterations to perform
    numIter: 2500,
    // Whether to tile disconnected nodes
    tile: true,
    // Type of layout animation. The option set is {'during', 'end', false}
    animate: 'during',
    // Duration for animate:end
    animationDuration: 500,
    // Amount of vertical space to put between degree zero nodes during tiling (can also be a function)
    tilingPaddingVertical: 10,
    // Amount of horizontal space to put between degree zero nodes during tiling (can also be a function)
    tilingPaddingHorizontal: 10,
    // Gravity range (constant) for compounds
    gravityRangeCompound: 1.5,
    // Gravity force (constant) for compounds
    gravityCompound: 1.0,
    // Gravity range (constant)
    gravityRange: 3.8,
    // Initial cooling factor for incremental layout
    initialEnergyOnIncremental: 0.5,
    spacingFactor: 1

  }).run()

  cy.fit()
  cy.snapToGrid('snapOn')
}


function resize() {
  if (cy) {
    cy.resize()
    cy.fit()
  }
}



//
// **** VS Code extension WebView specific functions below here ****
//

// Message handler in webview, messages are sent by extension.ts
window.addEventListener('message', event => {
  // Get message content
  const message = event.data

  // Parsed data received here from extension.ts refreshView() with results of ARMParser
  if (message.command == 'newData') {
    document.getElementById('mainview').style.display = 'block'
    document.getElementById('buttons').style.display = 'block'
    document.querySelector('.loader').style.display = 'none'


    // Call main display function (above)
    displayData(message.payload)
  }
})


//
// Get label for resource
//
function getLabel(node) {
  let label = decodeURIComponent(node.data(labelField))
  return label
}

function exportPNG() {
  if (cy) {
    const data = cy.png({ full: true, output: 'base64' })
    vscode.postMessage({ command: 'exportPNG', payload: data })
  }
}

function showDetails() {
  if (cy) {
    const nodeSelected = cy.$('node:selected')[0]
    vscode.postMessage({
      command: 'showDetails', payload: {
        resourceType: nodeSelected.data('type'),
        resourceId: nodeSelected.data('resourceId'),
      }
    })
  }
}