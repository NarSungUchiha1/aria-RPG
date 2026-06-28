/**
 * CHAPTER 4 — THE FACE OF THE VOID
 * Malachar enters the known zone.
 * Boss encounter with 1 billion HP.
 */

const CHAPTER4_LORE = `
╔══════════════════════════════════════════╗
┃                                          
┃   📜 ARIA SYSTEM — CHAPTER 4            
┃   *THE FACE OF THE VOID*                
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  Before the dungeons.                    
┃  Before the Gates.                       
┃  Before the System gave hunters          
┃  their ranks —                           
┃                                          
┃  Malachar was already here.              
┃                                          
┃  He did not invade.                      
┃  He was not summoned.                    
┃  He simply existed in the space          
┃  between worlds, older than the          
┃  language used to describe him.          
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  The Gates were humanity's mistake.      
┃  Built to travel between dimensions,     
┃  they cracked something that was         
┃  holding Malachar back.                  
┃                                          
┃  Not a seal.                             
┃  Not a prison.                           
┃  Just a wall he had chosen               
┃  not to walk through.                    
┃                                          
┃  When the Gates fell —                   
┃  he walked through.                      
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  The first hunters to encounter him      
┃  did not survive long enough             
┃  to report back.                         
┃                                          
┃  The System classified him               
┃  as an S-rank threat.                    
┃  Then SS.                                
┃  Then gave up classifying entirely       
┃  and marked him as — UNKNOWN.            
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  He has been watching since then.        
┃  Sending pieces of himself —             
┃  the Herald.                             
┃  The corrupted dungeons.                 
┃  The void storms.                        
┃                                          
┃  Not to destroy.                         
┃  To observe.                             
┃  To find something.                      
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  Three weeks ago —                       
┃  he stopped observing.                   
┃                                          
┃  The clans felt it first.                
┃  Their blessings surged without          
┃  being triggered.                        
┃  The void responded to something         
┃  it recognised.                          
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  Yesterday, the System issued            
┃  one message to all registered           
┃  hunters:                                
┃                                          
┃  ⚠️ MALACHAR HAS ENTERED                ┃
┃  ⚠️ THE KNOWN ZONE.                     ┃
┃  ⚠️ ALL HUNTERS MOBILIZE.               ┃
┃                                          
┃  He is not hiding.                       
┃  He is not running.                      
┃                                          
┃  He is waiting.                          
┃                                          
┃  And he wants to see                     
┃  what the hunters do next.               
┃                                          
╠══════════════════════════════════════════╣
┃                                          
┃  Enter a PS dungeon to face him.         
┃  Use !skill to fight.                    
┃  Every move counts.                      
┃                                          
┃  His HP: 1,000,000,000                   
┃  He will not go easy.                    
┃  Neither should you.                     
┃                                          
╚══════════════════════════════════════════╝`;

const MALACHAR_BOSS = {
    name: 'Malachar',
    hp: 10000000000,
    atk: 2100,
    def: 2500,
    evasion: 8,
    exp: 500000,
    gold: 1000000,
    moves: [
        { name: "Void Reckoning",  damage: 5.0 },
        { name: "Reality Shatter", damage: 4.0 },
        { name: "Eternal Fracture",damage: 6.0 }
    ],
    phases: [
        { threshold: 0.75, name: 'Phase 1 — Observation',  atkMult: 1.0, desc: 'He watches. Not yet committed.' },
        { threshold: 0.50, name: 'Phase 2 — Recognition',  atkMult: 1.5, desc: 'He sees you now. He is deciding.' },
        { threshold: 0.25, name: 'Phase 3 — Judgement',    atkMult: 2.2, desc: 'He has made his decision. You are not enough.' },
        { threshold: 0.00, name: 'Phase 4 — The Full Void',atkMult: 3.5, desc: 'This is what he was holding back.' }
    ]
};

module.exports = { CHAPTER4_LORE, MALACHAR_BOSS };