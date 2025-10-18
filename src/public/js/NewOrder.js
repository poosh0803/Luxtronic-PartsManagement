
document.addEventListener('DOMContentLoaded', () => {
  const machineSelect = document.getElementById('machine-select');
  const partsContainer = document.getElementById('parts-container');
  const addPartBtn = document.getElementById('add-part-btn');
  const orderForm = document.getElementById('order-form');
  const responseMessage = document.getElementById('response-message');

  let machines = [];
  let partsByMachine = {};

  // Fetch machines on page load
  fetch('/api/machines')
    .then(response => response.json())
    .then(data => {
      machines = data;
      populateMachineSelect();
    });

  function populateMachineSelect() {
    machines.forEach(machine => {
      const option = document.createElement('option');
      option.value = machine.id;
      option.textContent = machine.name;
      machineSelect.appendChild(option);
    });
  }

  machineSelect.addEventListener('change', () => {
    const machineId = machineSelect.value;
    if (machineId) {
      fetch(`/api/machines/${machineId}/parts`)
        .then(response => response.json())
        .then(data => {
          partsByMachine[machineId] = data;
          // Reset parts container when machine changes
          partsContainer.innerHTML = '';
          addPartRow();
        });
    }
  });

  let partIndex = 0;

  const addPartRow = () => {
    partIndex++;
    const partRow = document.createElement('div');
    partRow.classList.add('part-row');
    
    const machineId = machineSelect.value;
    const parts = partsByMachine[machineId] || [];
    
    let options = '<option value="">Select a part</option>';
    parts.forEach(part => {
      options += `<option value="${part.id}">${part.part_name}</option>`;
    });

    partRow.innerHTML = `
      <div class="form-group">
        <label for="part_id_${partIndex}">Part</label>
        <select id="part_id_${partIndex}" name="part_id" class="part-select" required>
          ${options}
        </select>
      </div>
      <div class="form-group">
        <label for="quantity_${partIndex}">Quantity</label>
        <input type="number" id="quantity_${partIndex}" name="quantity" required>
      </div>
      <div class="form-group">
        <label for="price_per_unit_${partIndex}">Price per Unit</label>
        <input type="number" step="0.01" id="price_per_unit_${partIndex}" name="price_per_unit" required>
      </div>
      <button type="button" class="remove-part-btn">Remove</button>
    `;
    partsContainer.appendChild(partRow);
  };

  addPartBtn.addEventListener('click', addPartRow);

  partsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-part-btn')) {
      e.target.parentElement.remove();
    }
  });

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    responseMessage.textContent = '';

    const formData = new FormData(orderForm);
    const orderData = {
      purpose: formData.get('purpose'),
      machine_id: machineSelect.value,
      customer_mobile_number: formData.get('customer_mobile_number'),
      source: formData.get('source'),
      parts: [],
    };

    const partRows = partsContainer.querySelectorAll('.part-row');
    partRows.forEach(row => {
      const part = {
        machine_part_id: row.querySelector('.part-select').value,
        quantity: row.querySelector('input[name="quantity"]').value,
        price_per_unit: row.querySelector('input[name="price_per_unit"]').value,
      };
      orderData.parts.push(part);
    });

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (response.ok) {
        responseMessage.textContent = `Order created successfully! Order ID: ${result.orderId}`;
        orderForm.reset();
        partsContainer.innerHTML = '';
        // Clear machine-specific parts cache
        partsByMachine = {};
        // Repopulate machine select and add initial part row
        machineSelect.innerHTML = '<option value="">Select a machine</option>';
        fetch('/api/machines')
          .then(response => response.json())
          .then(data => {
            machines = data;
            populateMachineSelect();
            addPartRow();
          });
      } else {
        responseMessage.textContent = `Error: ${result.error}`;
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      responseMessage.textContent = 'An unexpected error occurred.';
    }
  });

  // Add one part row by default
  addPartRow();
});
