<script lang="ts">
    import { fly } from "svelte/transition";

  import { onMount } from "svelte";


    let {
        imageUrls=[],
        imageAlts=[],
        poiTitles=[],
        currentSlideItem=0,
        closeGalery,
    }=$props<{
        imageUrls:string[];
        imageAlts:string[];
        poiTitles:string[];
        currentSlideItem:number;
        closeGalery:(currentSlideItem:number)=>void;
    }>()

  
  let flyX=$state(-500)
 
  const nextImage = () => {
    flyX=-500;
    while(imageUrls[currentSlideItem=(currentSlideItem + 1) % imageUrls.length].url==="");
  }
  const prevImage = () => {
    flyX=500;
    while(imageUrls[currentSlideItem=(currentSlideItem - 1 + imageUrls.length) % imageUrls.length].url==="");
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") {
        nextImage();
    } else if (event.key === "ArrowLeft") {
        prevImage();
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (!(event.target instanceof HTMLButtonElement)) {
        closeGalery(currentSlideItem);
    }
  }
onMount(()=>{
    window.addEventListener("pointerdown",handlePointerDown)
    window.addEventListener("keydown", handleKeydown);
    return(()=>{
        window.removeEventListener("pointerdown",handlePointerDown)
        window.removeEventListener("keydown", handleKeydown);
    })
})


</script>
<section class="galleryWrapper" aria-label="Bildergalerie">
  {#each [imageUrls[currentSlideItem]] as item (currentSlideItem)}
    <img in:fly={{duration:300, x:flyX,delay:100}} out:fly={{duration:300, x:-2*flyX, opacity:0}}  src={item} alt={imageAlts[currentSlideItem]} class="galery-image"/>
  {/each}
      <p class="image-label">{poiTitles[currentSlideItem]}</p>
    <button class="btn" id="previous-image" onclick={(e) =>{e.stopPropagation(); prevImage()}}>{"<"}</button>
    <button class="btn" id="next-image" onclick={(e) =>{e.stopPropagation(); nextImage()}}>{">"}</button>

</section>

<style>
    .galleryWrapper{
    position: inherit;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: column;
    height:100%;
    box-sizing: border-box;
    width: 100%;
    background:#263244;
    z-index: 1000;
    align-items: center;
    justify-content: center;
    overflow:visible;

  }
  .btn{
    border: 2px solid #172033;
    background: #ffffff;
    border-radius: 999px;
    width: 3rem;
    height: 4rem;
    color: #172033;
    font-weight: 800;
    font-size: 2rem;
    cursor: pointer;
  }
.galery-image{
  position:absolute;
    width: 100%;
    height:100%;
    object-fit: contain;
    max-height: 80vh;
    opacity: 1;
  }
#previous-image{
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);


  }
  #next-image{
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);


  }
  .image-label{
    position: absolute;
    bottom: 0rem;
    left: 50%;
    transform: translateX(-50%);
    color: #ffffff;
    font-size: 1.4rem;
  }
  </style>