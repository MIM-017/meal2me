'use server'

import { getRequestDb,
    createRecipe,
    createUser,
    User,
    getUserByUsername,
    NotFoundError} from "@/lib/db";

import { DIFFICULTIES } from "@/lib/db";

// export async function addMeal(formData: FormData, userId) {
//     const db = await getRequestDb();

//     let recipe = {
//         name: formData.get("name")?.toString() ?? "test meal",
//         cookTime: 10, // minutes
//         difficulty: "easy",
//         cost: 10, // dollars, whole recipe
//         macros: null,
//         ingredients: ["magic", "tears"],
//         notes: "we are doomed"
//     };

//     createRecipe(db, user.id, recipe);
// }

export async function addMealSystem(formData: FormData) {
    const db = await getRequestDb();

    let user: User;
    try {
        user = getUserByUsername(db, "system");
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            user = createUser(db, "system");
        }
        else {
            throw error;
        }
    }
    
    const name = formData.get("name")?.toString();
    const cookTime = Number(formData.get("cookTime")?.toString());
    const difficulty = formData.get("difficulty")?.toString();
    const cost = Number(formData.get("cost")?.toString());
    const proteins = Number(formData.get("proteins")?.toString());
    const calories = Number(formData.get("calories")?.toString());
    const carbs = Number(formData.get("carbs")?.toString());
    const imageUrl = formData.get("imageUrl")?.toString() || null;
    // const ingredients = formData.get("ingredients");  // Inoperable yet
    // const notes = formData.get("notes")?.toString();  // Inoperable yet

    if (!name) {
        throw new Error("Meal name not specified");
    }
    else if (typeof name !== "string") {
        throw new Error("Incorrect meal name value");
    }

    if (!cookTime) {
        throw new Error("Meal cook time not specified");
    }
    else if (Number.isNaN(cookTime) || cookTime < 0) {
        throw new Error("Incorrect meal cook time value");
    }

    if (!difficulty) {
        throw new Error("Meal difficulty not specified");
    }
    else if (typeof difficulty !== "string" || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
        throw new Error("Incorrect meal difficulty value");
    }

    if (!cost) {
        throw new Error("Meal cost not specified");
    }
    else if (Number.isNaN(cost) || cost < 0) {
        throw new Error("Incorrect meal cost value");
    }

    if (!proteins) {
        throw new Error("Meal proteins not specified");
    }
    else if (Number.isNaN(proteins) || proteins < 0) {
        throw new Error("Incorrect meal proteins value");
    }

    if (!calories) {
        throw new Error("Meal calories not specified");
    }
    else if (Number.isNaN(calories) || calories < 0) {
        throw new Error("Incorrect meal calories value");
    }

    if (!carbs) {
        throw new Error("Meal carbs not specified");
    }
    else if (Number.isNaN(carbs) || carbs < 0) {
        throw new Error("Incorrect meal carbs value");
    }


    const recipe = {
        name: name,
        cookTime: cookTime,
        difficulty: difficulty,
        cost: cost,
        macros: {protein: proteins, carbs: carbs, calories: calories},
        ingredients: ["Inoperable"],
        notes: null,
        imageUrl: imageUrl,   
    };

    console.log(createRecipe(db, user.id, recipe));
}
