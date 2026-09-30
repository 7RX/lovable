const cart = [];
const cartButton = document.getElementById('cartButton');
const cartDrawer = document.getElementById('cartDrawer');
const closeCart = document.getElementById('closeCart');
const overlay = document.getElementById('overlay');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const checkoutButton = document.getElementById('checkoutButton');

const currency = value => value.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });

function openCart(){
  cartDrawer.classList.add('open');
  overlay.classList.add('show');
  cartDrawer.setAttribute('aria-hidden','false');
}

function closeCartDrawer(){
  cartDrawer.classList.remove('open');
  overlay.classList.remove('show');
  cartDrawer.setAttribute('aria-hidden','true');
}

function renderCart(){
  cartCount.textContent = cart.length;
  const total = cart.reduce((sum,item)=>sum+item.price,0);
  cartTotal.textContent = currency(total);

  if(!cart.length){
    cartItems.innerHTML = '<p class="empty-cart">Seu carrinho está vazio.</p>';
    return;
  }

  cartItems.innerHTML = cart.map((item,index)=>`
    <div class="cart-item">
      <div>
        <strong>${item.name}</strong>
        <div>${currency(item.price)}</div>
      </div>
      <button aria-label="Remover item" data-remove="${index}">✕</button>
    </div>
  `).join('');

  document.querySelectorAll('[data-remove]').forEach(button=>{
    button.addEventListener('click',()=>{
      cart.splice(Number(button.dataset.remove),1);
      renderCart();
    });
  });
}

document.querySelectorAll('.add-cart').forEach(button=>{
  button.addEventListener('click',()=>{
    cart.push({
      name:button.dataset.product,
      price:Number(button.dataset.price)
    });
    renderCart();
    openCart();
  });
});

cartButton.addEventListener('click',openCart);
closeCart.addEventListener('click',closeCartDrawer);
overlay.addEventListener('click',closeCartDrawer);

checkoutButton.addEventListener('click',()=>{
  if(!cart.length){
    alert('Adicione pelo menos um produto ao carrinho.');
    return;
  }
  const total = cart.reduce((sum,item)=>sum+item.price,0);
  alert('Carrinho pronto! Total: ' + currency(total) + '. Conecte este botão ao seu checkout ou WhatsApp.');
});

renderCart();