import React from 'react';
import loopKanbanAsset from '@/assets/lp/loop_kanban.mp4.asset.json';
const loopKanbanVideo = loopKanbanAsset.url;
const SolutionSection: React.FC = () => {
  return <section className="bg-soma-black py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex-col md:flex-row gap-8 mb-16 flex items-center justify-center">
          <div className="text-center">
            <span className="inline-block px-4 py-2 bg-soma-orange-light/20 text-soma-orange-light rounded-full text-sm font-semibold mb-4">
              A SOLUÇÃO
            </span>
            <h2 className="text-3xl font-bold text-white md:text-5xl">
              Sistema Operacional para Marketing
            </h2>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-12">
          <div className="md:w-1/2">
            <p className="text-xl md:text-2xl text-gray-300 leading-relaxed mb-12">
              O SoMA ajuda equipes e freelancers de marketing a visualizarem exatamente o que foi entregue, 
              o que ainda pode ser solicitado e o que está fora do escopo. 
              <span className="block mt-4 text-4xl font-semibold text-left text-white">Clareza para quem executa. Transparência para quem contrata.</span>
            </p>
            
            {/* Feature cards */}
            
            
            {/* Subscription button in the middle */}
            
          </div>
          
          <div className="md:w-1/2">
            <div className="rounded-xl overflow-hidden shadow-md border border-gray-700">
              <video 
                src={loopKanbanVideo} 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default SolutionSection;