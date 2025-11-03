import { RecommendationModel } from '../models/recommendationModel.js';
import { CycleModel } from '../models/cycleModel.js';

export const getRecommendations = async (req, res) => {
    try {
        const { cycleId } = req.params;
        const cycle = await CycleModel.getById(cycleId);
        if (!cycle) {
            return res.status(404).json({ message: 'Cycle not found' });
        }
        
        // The generate function needs the full cycle object
        const recommendations = await RecommendationModel.generate(cycle);
        res.status(200).json(recommendations);
        
    } catch (error) {
        console.error("Error generating recommendations:", error);
        res.status(500).json({ message: "Error generating recommendations", error: error.message });
    }
};