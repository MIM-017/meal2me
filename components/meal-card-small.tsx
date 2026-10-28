import { MealSearchResult } from "@/app/lib/searchMeals";
import Image from "next/image";
import Link from "next/link";

export default function MealCard({ meal }: { meal: MealSearchResult}) {

    return (
        <div className="meal-card">
            {meal.imageUrl ? 
            <Image src={meal.imageUrl} alt={meal.name + "image"} 
            width={600} 
            height={400}
            style={{width: "100%", height: "auto", aspectRatio: 1.5, objectFit: "cover" }}/> : null}
            
            <div className="meal-name">
                <Link href={`/recipes/${meal.id}`}>{meal.name}</Link>
            </div>
        </div>
    );
}