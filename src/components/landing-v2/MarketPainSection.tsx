import React from 'react';

const MarketPainSection: React.FC = () => {
  return (
    <section className="bg-white py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <span className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4">
          O PROBLEMA
        </span>
        <h2 className="text-3xl md:text-5xl font-bold text-soma-black mb-12 max-w-3xl text-center md:text-left">
          Quando o escopo não é visível, <span className="text-soma-orange-dark">tudo vira urgência</span>.
        </h2>
        
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <div className="md:w-1/2">
            <p className="text-gray-700 text-lg md:text-xl leading-relaxed mb-8">
              Times de marketing trabalham com escopos fixos de entrega. Mas, na prática, sem um controle claro, 
              os clientes ultrapassam esse limite — e a equipe paga o preço: mais demanda, mais estresse, menos performance.
            </p>
            
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 md:p-8 border-l-4 border-soma-orange-medium rounded">
              <p className="text-gray-700 text-lg md:text-xl italic mb-4">
                "79% das agências de marketing relatam dificuldades em controlar a carga de trabalho de 
                clientes com escopos mal definidos."
              </p>
              <p className="text-soma-orange-dark text-sm">— Workamajig Report, 2023</p>
            </div>
          </div>
          
          <div className="md:w-1/2">
            {/* Visual element showing scope issues */}
            <div className="bg-gray-100 rounded-lg p-6 md:p-8">
              <h3 className="text-xl md:text-2xl font-bold text-soma-black mb-6">Escopo vs. Realidade</h3>
              <div className="space-y-6">
                {/* Contracted vs actual bar chart visualization */}
                <div className="space-y-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Cliente A</span>
                    <span className="text-soma-orange-dark">150% do contratado</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-full overflow-hidden flex">
                    <div className="bg-soma-orange-medium w-2/3 h-full"></div>
                    <div className="bg-red-500/70 w-5/12 h-full"></div>
                  </div>
                  
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Cliente B</span>
                    <span className="text-soma-orange-dark">120% do contratado</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-full overflow-hidden flex">
                    <div className="bg-soma-orange-medium w-4/5 h-full"></div>
                    <div className="bg-red-500/70 w-1/5 h-full"></div>
                  </div>
                  
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Cliente C</span>
                    <span className="text-green-600">90% do contratado</span>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-full overflow-hidden">
                    <div className="bg-green-500 w-11/12 h-full"></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500 pt-2">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-soma-orange-medium rounded-full mr-2"></div>
                    <span>Escopo contratado</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500/70 rounded-full mr-2"></div>
                    <span>Fora do escopo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketPainSection;
