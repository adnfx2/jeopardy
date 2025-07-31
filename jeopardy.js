/*
=== Terminology for the API ===

Clue: The name given to the structure that contains the question and the answer together.
Category: The name given to the structure containing clues on the same topic.
 */

/*
=== Data Structure of Request the API Endpoints ===

/categories:
[
  {
    "id": <category ID>,
    "title": <category name>,
    "clues_count": <number of clues in the category where each clue has a question, an answer, and a value>
  },
  ... more categories
]

/category:
{
  "id": <category ID>,
  "title": <category name>,
  "clues_count": <number of clues in the category>,
  "clues": [
    {
      "id": <clue ID>,
      "answer": <answer to the question>,
      "question": <question>,
      "value": <value of the question (be careful not all questions have values)>,
      ... more properties
    },
    ... more clues
  ]
}
 */

const API_URL = "https://rithm-jeopardy.herokuapp.com/api/"; // The URL of the API.
const NUMBER_OF_CATEGORIES = 6; // The number of categories you will be fetching. You can change this number.
const NUMBER_OF_CLUES_PER_CATEGORY = 5; // The number of clues you will be displaying per category. You can change this number.
// Constants for activeClueMode game
const NO_CLUES_SELECTED = "NO_CLUES_SELECTED";
const SHOWING_QUESTION = "SHOWING_QUESTION";
const SHOWING_ANSWER = "SHOWING_ANSWER";
const GAME_OVER = "GAME_OVER";

// GAME STATE - DEFAULT
function createGameState(params) {
  return {
    categories: {},
    cluesByCategoriesIds: {},
    categoriesDone: 5,
    activeClue: null,
    activeClueMode: NO_CLUES_SELECTED, // Controls the flow of #active-clue element while selecting a clue, displaying the question of selected clue, and displaying the answer to the question.
  };
}

let gameState = null;

// isPlayButtonClickable Only clickable when the game haven't started yet or ended. Prevents the button to be clicked during the game.

$("#play").on("click", handleClickOfPlay);

/**
 * Manages the behavior of the play button (start or restart) when clicked.
 * Sets up the game.
 */
function handleClickOfPlay() {
  // START GAME
  console.log("START GAME");
  $("#play").prop("disabled", true);
  setupTheGame();
}

/**
 * Sets up the game.
 *
 * 1. Cleans the game since the user can be restarting the game.
 * 2. Get category IDs
 * 3. For each category ID, get the category with clues.
 * 4. Fill the HTML table with the game data.
 */
async function setupTheGame() {
  //SETUP GAME INITIAL STATE
  gameState = createGameState();

  // CLEAN UI
  $("#active-clue").addClass("disabled");
  $("#spinner").toggleClass("disabled");
  $("#categories, #clues, #active-clue").empty();

  // FETCH JEOPARDY API
  $("#play").text("loading...");
  const [categoriesIds, categoriesById] = await getCategoryIds();
  const cluesByCategoriesIds = await getCategoriesData(categoriesIds);
  $("#spinner").toggleClass("disabled");
  $("#play").text("Select a clue!");

  // UPDATE gameState WITH FETCHED DATA
  gameState = {
    ...gameState,
    categories: { ids: categoriesIds, ...categoriesById },
    cluesByCategoriesIds,
  };

  //DRAW DATA FOR USER
  fillTable();
}

/**
 * Fetch as many category IDs as in the `NUMBER_OF_CATEGORIES` constant.
 */
async function getCategoryIds() {
  // RESULTS VARIABLES AFTER FETCHING
  let categoriesIds = [];
  let categoriesById = {};

  // API categories SETUP
  const ENDPOINT_CATEGORIES = "categories";
  const MAX_COUNT_REQUEST = 100;
  const api_request = API_URL + ENDPOINT_CATEGORIES;
  const params = { count: MAX_COUNT_REQUEST };

  // FETCH CATEGORIES
  try {
    const rawCategories = await axios.get(api_request, { params });
    const fetchedCategories = rawCategories.data;

    // RANDOMLY PICKS A NUMBER_OF_CATEGORIES
    for (let i = 0; i < NUMBER_OF_CATEGORIES; i++) {
      const randIndex = Math.floor(Math.random() * fetchedCategories.length);
      const fetchedCategory = fetchedCategories[randIndex];
      const isCategoryRepeated =
        categoriesIds.indexOf(fetchedCategory.id) !== -1;

      // PREVENTS ADDING SAME CATEGORY
      if (!isCategoryRepeated) {
        categoriesIds.push(fetchedCategory.id);
        categoriesById = {
          ...categoriesById,
          [fetchedCategory.id]: fetchedCategory,
        };
      } else {
        i--;
      }
    }
  } catch (error) {
    console.error("getCategories failed", { error });
  }
  return [categoriesIds, categoriesById];
}

/**
 * Gets category with as many clues as given in the `NUMBER_OF_CLUES` constant.
 * Returns the below data structure:
 *  {
 *    "id": <category ID>
 *    "title": <category name>
 *    "clues": [
 *      {
 *        "id": <clue ID>,
 *        "value": <value of the question>,
 *        "question": <question>,
 *        "answer": <answer to the question>
 *      },
 *      ... more clues
 *    ]
 *  }
 */
async function getCategoriesData(categoriesIds) {
  // ENSURE categoriesIds is in the right type of data
  if (typeof categoriesIds !== typeof []) return;
  // FETCH RESULTS STORAGE
  let categoriesWithClues;
  const ENDPOINT_CATEGORY = "category";
  const api_get_category = API_URL + ENDPOINT_CATEGORY;
  try {
    const rawCategoriesClues = await axios.all(
      categoriesIds.map((id) =>
        axios.get(api_get_category, { params: { id } }),
      ),
    );
    categoriesWithClues = rawCategoriesClues.reduce(
      (prevCategory, category) => {
        const { id, clues } = category.data;
        const normalizedClues = clues
          .slice(0, NUMBER_OF_CLUES_PER_CATEGORY)
          .reduce(
            (prevClues, clue) => ({
              ...prevClues,
              cluesIds: [...prevClues.cluesIds, clue.id],
              [clue.id]: clue,
            }),
            { cluesIds: [] },
          );
        normalizedClues.viewed = 0;
        return { ...prevCategory, [id]: normalizedClues };
      },
      {},
    );
  } catch (error) {
    console.error("getCategoryData", error);
  }
  return categoriesWithClues;
}

/**
 * Fills the HTML table using category data.
 */
function fillTable() {
  const { categories, cluesByCategoriesIds } = gameState;
  const addCategories = (catId) =>
    $(`<th class="category">`).append(categories[catId].title);

  const addClues = (catId) => {
    const clues = cluesByCategoriesIds[catId];
    const { cluesIds } = clues;

    const addQuestion = (clueId) => {
      const clue = clues[clueId];
      const $clueElement = $("<tr>", {
        class: "clue",
        ["data-category-id"]: catId,
        ["data-clue-id"]: clueId,
      });
      return $clueElement.append(`<h4>${clue.value || 1000}</h4>`);
    };

    const categoryQuestions = cluesIds.map(addQuestion);
    return $("<td>").append(categoryQuestions);
  };

  $("#categories").append(categories.ids.map(addCategories));
  $("#clues").append(categories.ids.map(addClues));
}

$("#clues").on("click", handleClickOfClue);

/**
 * Manages the behavior when a clue is clicked.
 * Displays the question if there is no active question.
 */
function handleClickOfClue(event) {
  const selectedClue = event.target.closest("tr");

  // RUN ONLY WHEN GAME IS NOT OVER - NO QUESTION IS SELECTED
  if (gameState.activeClueMode === GAME_OVER) return;
  if (gameState.activeClueMode === SHOWING_QUESTION) return;
  if (gameState.activeClueMode === SHOWING_ANSWER) return;
  if (selectedClue.classList.contains("viewed")) return;

  // GET CLUE CLICKED
  const dataCategoryId = selectedClue.attributes["data-category-id"];
  const dataClueId = selectedClue.attributes["data-clue-id"];

  if (!dataCategoryId) return;

  const categoryId = dataCategoryId.value;
  const clueId = dataClueId.value;

  // GET CURRENT GAMESTATE
  const clues = gameState.cluesByCategoriesIds[categoryId];
  gameState.activeClueMode = SHOWING_QUESTION;
  gameState.activeClue = clues[clueId];

  // FLAG CLUE AS VIEWED
  clues.viewed++;
  selectedClue.classList.toggle("viewed");
  $("#active-clue").toggleClass("disabled");

  // TRACK CATEGORIES DONE WHEN CLUES ANSWERED
  const isCluesDone = clues.viewed === clues.cluesIds.length;
  if (isCluesDone) gameState.categoriesDone++;

  // DISPLAY SELECTED CLUE
  $("#active-clue").append(`
    <h4>Clue</h4>
    <p>${clues[clueId].question}</p>
    <button>see answer</button>
  `);
}

$("#active-clue").on("click", handleClickOfActiveClue);

/**
 * Manages the behavior when a displayed question or answer is clicked.
 * Displays the answer if currently displaying a question.
 * Clears if currently displaying an answer.
 */
function handleClickOfActiveClue() {
  let { activeClue, activeClueMode } = gameState;

  // AFTER QUESTION => DISPLAY ANSWER
  if (activeClueMode === SHOWING_QUESTION) {
    gameState.activeClueMode = SHOWING_ANSWER;
    gameState.cluesByCategoriesIds;

    $("#active-clue").html(`
    <h4>Answer</h4>
    <p>${activeClue.answer}</p>
    <button>continue</button>
  `);
    return;
  }
  // AFTER ANSWER => CLEAR
  if (activeClueMode === SHOWING_ANSWER) {
    const isGameOver =
      gameState.categoriesDone === gameState.categories.ids.length;
    // ALL QUESTION VIEWED => DISPLAY GAME OVER
    if (isGameOver) {
      gameState.activeClueMode = GAME_OVER;
      $("#play").text("Restart the Game!");
      $("#play").prop("disabled", false);
      $("#active-clue").html(`
        <h4>You did it!</h4>
        <p>Game Over!</p>
        <button onclick="handleClickOfPlay()" >Ready for another round?</button>
      `);
      return;
    }
    gameState.activeClueMode = NO_CLUES_SELECTED;
    gameState.activeClue = null;
    $("#active-clue").html(null);
    $("#active-clue").toggleClass("disabled");
  }
}
