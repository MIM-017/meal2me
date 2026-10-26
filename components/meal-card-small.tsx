import { RecipeSummary } from "@/lib/db";
import Image from "next/image";

export default function MealCard({ meal }: { meal: RecipeSummary}) {

    return (
        <div className="meal-card">
            {meal.imageUrl ? 
            <Image src={meal.imageUrl} alt={meal.name + "image"} 
            width={600} 
            height={400}
            style={{width: "100%", height: "auto", aspectRatio: 1.5, objectFit: "cover" }}/> : null}
            
            <div className="meal-name">
                {meal.name}
            </div>
        </div>
    );
}